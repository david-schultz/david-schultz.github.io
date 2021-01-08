 /*
 * Name: David Schultz
 * Date: 11.20.2020
 * Section: CSE 154 AF / Wilson Tang
 *
 * This file handles the Node.js endpoints for the chess API.
 *
 * Chess piece icons obtained from wikimedia commons:
 * https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
 */

"use strict";

const express = require('express');
const multer = require("multer");
const sqlite3 = require('sqlite3');
const sqlite = require('sqlite');
const { write } = require('fs');
const app = express();
app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(multer().none());

const BOARD_SIZE = 8;
const A_CHAR_CODE = 97;
const CLIENT_ERROR_CODE = 400;
const MAX_ID = 999999;
const PORT_NUMBER = 8080;
let boardState;
let curMatchId;

/**
 * GET endpoint which sends a JSON response detailing info on a fresh match.
 * @param {obj} req - Request sent to endpoint
 * @param {obj} res - Response sent back to client
 * @return {JSON} Match data about initial chess piece placements
 */
app.get('/chess/getmatch', async function(req, res) {
  res.type('json');
  res.send(await writeNewMatch());
});

async function writeNewMatch() {
  const db = await getDBConnection();
  let sql = 'INSERT INTO matches (next_move, in_check) VALUES (?, ?)';
  let id = (await db.run(sql, ['white', 'none'])).lastID;
  await db.close();
  let match = {
    'match-id': id,
    'pieces': combineArrays(await initPieces('white', id), await initPieces('black', id))
  };
  curMatchId = id;
  return match;
}


/**
 * Returns an array of JSON object pieces of the given color.
 * @param {string} color - Color of pieces
 * @return {array} Array of JSON objects representing pieces
 */
async function initPieces(color, matchId) {
  let pieces = [];
  let backRow;
  let pawnRow;
  if (color === 'white') {
    backRow = 1;
    pawnRow = 2;
  } else {
    backRow = BOARD_SIZE;
    pawnRow = BOARD_SIZE - 1;
  }
  for (let i = 0; i < BOARD_SIZE; i++) {
    let file = String.fromCharCode(A_CHAR_CODE + i);
    pieces[i] = await initPiece(color, 'pawn', file + pawnRow, matchId);
    pieces[i + BOARD_SIZE] = await initPiece(color, getBackRow(i), file + backRow, matchId);
  }
  return pieces;
}


/**
 * Returns a JSON object representing a piece, with the given attributes.
 * @param {string} color - Color of piece
 * @param {string} type - Type of piece
 * @param {string} position - Position of piece
 * @return {string} Name of piece
 */
async function initPiece(color, type, position, matchId) {
  const db = await getDBConnection();
  let an = getArrayNotation(position);
  let sql = 'INSERT INTO pieces (type, color, position, position_rank, position_file, alive, match_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await db.run(sql, [type, color, position, an[0], an[1], 1, matchId]);
  await db.close();
  let piece = {
    "color": color,
    "type": type,
    "alive": true,
    "position": position
  };
  return piece;

}

/**
 * POST endpoint which sends a text response detailing the positions of each piece,
 * separated by color.
 * @param {obj} req - Request sent to endpoint
 * @param {obj} res - Response sent back to client
 * @return {JSON} Match data about initial chess piece placements
 */
app.post('/chess/pieces', function(req, res) {
  res.type('text');
  let matchId = req.body.matchid;
  if (parseInt(boardState['match-id']) !== parseInt(matchId)) {
    res.status(CLIENT_ERROR_CODE).send('Invalid POST parameter: matchid');
  } else {
    res.send(pieceList(boardState['match-state']));
  }
});

/**
 * POST endpoint which receives a match id, and two coordinates which represent
 * a piece's coordinate, and the coordinate to move to.
 * Sends back an updated JSON matchstate.
 * @param {obj} req - Request sent to endpoint
 * @param {obj} res - Response sent back to client
 * @return {JSON} Match data containing new chess piece placements, and the last move
 */
app.post('/chess/move', async function(req, res) {
  let matchId = req.body.matchid;
  let coord = req.body.coord;
  let newCoord = req.body.newcoord;

  const db = await getDBConnection();
  let sql = 'SELECT next_move FROM matches WHERE id = ?';
  let nextMove = (await db.all(sql, matchId))[0]['next_move'];
  sql = 'SELECT id, type, color, position, alive FROM pieces WHERE match_id = ? AND position = ?';
  let curPosition = (await db.all(sql, [matchId, coord]))[0];
  let newPosition = (await db.all(sql, [matchId, newCoord]))[0];

  console.log(nextMove);
  console.log(curPosition, newPosition);

  if (matchId === undefined || coord === undefined || newCoord === undefined) {
    res.status(CLIENT_ERROR_CODE).json({
      'error': 'Missing required POST parameters: matchid, coord, newcoord'
    });
  } else if (nextMove.length === 0) {  //TODO: validate syntax (if next move is empty, user has wrong matchid)
    res.status(CLIENT_ERROR_CODE).json({
      'error': 'Invalid match id'
    });
  } else if (nextMove !== curPosition['color']) {
    res.status(CLIENT_ERROR_CODE).json({
      'error': 'It is the other players turn'
    });
  } else {
    sql = 'UPDATE matches SET next_move = ? WHERE id = ?';
    await db.run(sql, [getOppositeColor(nextMove), matchId]);
    if (newPosition.length === 0 || newPosition['alive'] === 0) { // if new square is empty, just move piece

    } else { // else if new square is filled, 1. confirm enemy piece, 2. capture piece
      sql = 'UPDATE pieces SET alive = 0, position = null WHERE id = ?';
      await db.run(sql, [newPosition['id']]);
    }
    sql = 'UPDATE pieces SET position = ? WHERE id = ?';
    await db.run(sql, [newCoord, curPosition['id']]);

    // console.log(getCoordPiece(matchState, coord));
    sql = 'SELECT id, type, color, position, alive, FROM pieces WHERE match_id = ?';
    let match = {
      'match-id': matchId,
      'pieces': await db.all(sql, [matchId])
    };
    res.json(match);
  }
  await db.close();
});

app.get('/chess/getmoves', async function(req, res) {
  let position = req.query.position;
  let matchId = req.query.match_id;

  const db = await getDBConnection();
  let sql = 'SELECT type, color, position_rank, position_file, alive FROM pieces WHERE match_id = ?';
  let allPieces = await db.all(sql, matchId);
  sql = 'SELECT type, color, position, position_rank, position_file FROM pieces WHERE match_id = ? AND position = ?'
  let selectedPiece = await db.all(sql, [matchId, position]);
  await db.close();

  if (selectedPiece.length === 0) {
    res.status(CLIENT_ERROR_CODE).json({'error': 'No piece selected'});
  } else {
    let moveSet = await getMoveSet(allPieces, selectedPiece, matchId);
    for (let i = 0; i < moveSet.length; i++) {
      moveSet[i] = getAlgebraicNotation(moveSet[i]);
    }
    res.json(moveSet);
  }
});

/* ============== * - MOVESETS - * ==============
 *
 * In general, these scenarios always have to be looked for:
 *  - Piece is pinned
 *  - Movement off the board
 *  - Piece is in the way
 *  - Function for capturing a piece
 *
 */

/**
 * Returns an array of all coordinates the given piece can move to in the given matchState.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {JSON} piece - Piece data regarding it's placement, color, and type
 * @return {array} String array of all coordinates the piece can move to
 */
async function getMoveSet(allPieces, piece, matchId) {
  let board = convertToBoard(allPieces);
  let moveSet = [];
  // let file = piece['position'].substring(0, 1);
  // let rank = parseInt(piece['position'].substring(1));
  if (piece[0]['type'] === 'pawn') {
    moveSet = await pawnMoves(board, piece[0], matchId);
  } else if (piece[0]['type'] === 'knight') {
    moveSet = knightMoves(matchState, piece[0], matchId);
  } else if (piece[0]['type'] === 'bishop') {
    moveSet = bishopMoves(matchState, piece[0], matchId);
  } else if (piece[0]['type'] === 'rook') {
    moveSet = rookMoves(matchState, piece[0], matchId);
  } else if (piece[0]['type'] === 'queen') {
    moveSet = queenMoves(matchState, piece[0], matchId);
  } else if (piece[0]['type'] === 'king') {
    moveSet = kingMoves(matchState, piece[0], matchId);
  }

  return moveSet;
}

async function pawnMoves(board, piece, matchId) {
  let moveSet = [];
  let curPosition = [piece['position_rank'], piece['position_file']];
  let orientation = (piece['color'] === 'white');
  if (orientation) {
    if (curPosition[0] === 6) {
      moveSet.push([curPosition[0] - 2, curPosition[1]]);
    }
    moveSet.push([curPosition[0] - 1, curPosition[1]]);
    moveSet.push([curPosition[0] - 1, curPosition[1] - 1]);
    moveSet.push([curPosition[0] - 1, curPosition[1] + 1]);
  } else {
    if (curPosition[0] === 1) {
      moveSet.push([curPosition[0] + 2, curPosition[1]]);
    }
    moveSet.push([curPosition[0] + 1, curPosition[1]]);
    moveSet.push([curPosition[0] + 1, curPosition[1] - 1]);
    moveSet.push([curPosition[0] + 1, curPosition[1] + 1]);
  }
  moveSet = await validatePawnMoves(board, moveSet, matchId, piece['color'], curPosition);
  return moveSet;
}

//TODO: doesn't leave king in check
async function validatePawnMoves(board, moveSet, matchId, color, position) {
  let validMoves = [];
  for (let i = 0; i < moveSet.length; i++) {
    let validRank = (moveSet[i][0] >= 0 && moveSet[i][0] < 8);
    let validFile = (moveSet[i][1] >= 0 && moveSet[i][1] < 8);
    if (validRank && validFile) {
      validMoves.push(moveSet[i]);
    }
  }
  for (let i = 0; i < validMoves.length; i++) {
    let check = await checkPosition(matchId, getAlgebraicNotation(validMoves[i]));

    if (validMoves[i][1] != position[1]) { // if move is diagonal from position
      if (check.length === 0) { // if there is no piece on square
        validMoves.splice(i, 1);
        i--;
      } else if (check['color'] === color) { // if own piece is on square
        validMoves.splice(i, 1);
        i--;
      }
    } else {  // if move is straight ahead
      if (check.length !== 0) { // if there is a piece on square
        validMoves.splice(i, 1);
        i--;
      }
    }
  }
  return validMoves;
}

async function checkPosition(matchId, position) {
  const db = await getDBConnection();
  let sql = 'SELECT color, alive FROM pieces WHERE match_id = ? AND position = ?';
  let piece = await db.all(sql, [matchId, position]);
  await db.close();
  return piece;
}

function knightMoves(matchState, piece) {

}

function bishopMoves(matchState, pieces) {

}

function rookMoves(matchState, pieces) {

}

function queenMoves(matchState, pieces) {

}

function kingMoves(matchState, pieces) {

}

function convertToBoard(allPieces) {
  let board = [];
  for (let i = 0; i < 8; i++) {
    board[i] = [];
  }
  for (let i = 0; i < allPieces.length; i++) {
    let piece = allPieces[i];
    if (piece['alive'] === 1) {
      board[piece['position_rank']][piece['position_file']] = piece;
    }
  }
  return board;
}

/**
 * Returns the opposite of the given color, either 'white' or 'black'.
 * @param {string} color - Color to return  opposite of
 * @return {string} Opposite of given color
 */
function getOppositeColor(color) {
  if (color === 'white') {
    return 'black';
  }
  return 'white';
}

/**
 * Returns the piece at the given coord in the given matchState.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {string} coord - Coordinate to find piece at
 * @return {JSON} Piece data regarding it's placement, color, and type
 */
function getCoordPiece(matchState, coord) {
  let piece;
  for (let i = 0; i < matchState['pieces'].length; i++) {
    if (matchState['pieces'][i]['position'] === coord) {
      piece = matchState['pieces'][i];
    }
  }
  return piece;
}

/**
 * Takes a given match state and move, and returns a modified JSON match state
 * reflecting the given move.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {string} coord - Coordinate of piece to move
 * @param {string} newCoord - Coordinate piece wants to move to
 * @return {JSON} Match data, containing the last move and piece placements
 */
function makeMove(matchState, coord, newCoord) {
  let newerMatchState = {
    'pieces': []
  };
  let piece;
  for (let i = 0; i < matchState['pieces'].length; i++) {
    if (matchState['pieces'][i]['position'] === coord) {
      piece = matchState['pieces'][i];
      piece['position'] = newCoord;
      newerMatchState['pieces'][i] = piece;
    } else {
      newerMatchState['pieces'][i] = matchState['pieces'][i];
    }
  }
  newerMatchState['last-move'] = {
    "piece": piece['type'],
    "coord": coord,
    "new-coord": newCoord,
    "color": piece['color']
  };
  boardState['match-state'] = newerMatchState;
  return newerMatchState;
}

/**
 * Returns an array of valid coordinates the given piece can move to in the given matchState.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {JSON} piece - Piece data regarding it's placement, color, and type
 * @return {array} String array of valid coordinates the piece can move to
 */
function validMoveSet(matchState, piece) {
  let moveSet = [];
  let pieceType = piece['type'];
  if (pieceType === 'pawn') {
    return getMoveSet(matchState, piece);
  }
  return moveSet;
}

function getArrayNotation(position) {
  let arrayNotation = [];
  arrayNotation[0] = 8 - parseInt(position.substring(1));
  arrayNotation[1] = position.charCodeAt(0) - 97;
  return arrayNotation;
}

function getAlgebraicNotation(position) {
  let algebraic = String.fromCharCode(position[1] + 97);
  algebraic += '' + (8 - position[0]);
  return algebraic;
}



/**
 * Returns a fresh matchstate containing an empty last move, and initial piece placements.
 * @return {JSON} Piece data regarding it's placement, color, and type
 */
function newMatchState() {
  let matchState = { };
  let pieces = combineArrays(initPieces('white'), initPieces('black'));
  matchState['pieces'] = pieces;
  matchState['last-move'] = {
    "piece": null,
    "coord": null,
    "new-coord": null,
    "color": "black"
  };
  boardState = matchState;
  return matchState;
}

/**
 * Returns an array of the combined, given arrays.
 * @param {array} array1 - First array to combine
 * @param {array} array2 - Second array to combine
 * @return {array} Combined array
 */
function combineArrays(array1, array2) {
  let array3 = [];
  for (let i = 0; i < array1.length; i++) {
    array3[i] = array1[i];
  }
  for (let i = array1.length; i < array1.length + array2.length; i++) {
    array3[i] = array2[i - array1.length];
  }
  return array3;
}

/**
 * Returns the name of a piece, given the initial file the piece is in.
 * @param {string} index - Represents the initial file the piece is at
 * @return {string} Name of piece
 */
function getBackRow(index) {
  if (index === 0 || index === BOARD_SIZE - 1) {
    return 'rook';
  } else if (index === 1 || index === BOARD_SIZE - 2) {
    return 'knight';
  } else if (index === 2 || index === BOARD_SIZE - 3) {
    return 'bishop';
  } else if (index === 3) {
    return 'queen';
  }
  return 'king';
}

/**
 * Returns a string containing the list of all pieces on the board that are alive.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @return {string} String list of all alive pieces on board.
 */
function pieceList(matchState) {
  let list = '';
  for (let i = 0; i < matchState['pieces'].length; i++) {
    let piece = matchState['pieces'][i];
    if (piece['status']) {
      list += piece['color'] + ' ' + piece['type'] + ' at ' + piece['position'];
      list += ', ';
    }
  }
  return list;
}

/**
 * Creates and returns a random id between 0 and 999999.
 * @return {int} id
 */
function idCreator() {
  let id = Math.floor(Math.random() * MAX_ID);
  return id;
}

/**
 * Returns the database connection for yipper.db.
 * @return {db} Database connection
 */
async function getDBConnection() {
  const db = await sqlite.open({
    filename: 'chess.db',
    driver: sqlite3.Database
  });
  return db;
}

app.use(express.static('public'));
const PORT = process.env.PORT || PORT_NUMBER;
app.listen(PORT);
