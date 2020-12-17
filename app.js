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

/**
 * GET endpoint which sends a JSON response detailing info on a fresh match.
 * @param {obj} req - Request sent to endpoint
 * @param {obj} res - Response sent back to client
 * @return {JSON} Match data about initial chess piece placements
 */
app.get('/chess/getmatch', async function(req, res) {
  const db = await getDBConnection();
  res.type('json');
  let matchId = idCreator('match');
  let matchState = newMatchState();
  let match = {
    'match-id': matchId,
    'match-state': matchState
  };
  boardState = match;
  res.send(match);
});

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
app.post('/chess/move', function(req, res) {
  res.type('json');
  let matchId = req.body.matchid;
  let coord = req.body.coord;
  let newCoord = req.body.newcoord;

  if (matchId === undefined || coord === undefined || newCoord === undefined) {
    res.status(CLIENT_ERROR_CODE).send({
      'error': 'Missing required POST parameters: matchid, coord, newcoord'
    });
  } else if (matchId > MAX_ID || matchId < 0) {
    res.status(CLIENT_ERROR_CODE).send({
      'error': 'Invalid match id'
    });
  } else {
    let matchState = boardState['match-state'];
    let isValid = checkValid(matchState, coord, newCoord);
    if (isValid) {
      matchState = makeMove(matchState, coord, newCoord);
    }
    matchState['valid'] = isValid;
    res.send(matchState);
  }
});

/**
 * Returns whether the given move (coord, newcoord) is valid, per the given matchState.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {string} coord - Coordinate of piece to move
 * @param {string} newcoord - Coordinate piece wants to move to
 * @return {boolean} Whether the given move is valid or not
 */
function checkValid(matchState, coord, newcoord) {
  let color = getOppositeColor(matchState['last-move']['color']);
  let piece = getCoordPiece(matchState, coord);
  if (piece['color'] !== color || piece['type'] !== 'pawn' || piece['status'] === 'dead') {
    return false;
  }
  let validMoves = validMoveSet(matchState, piece);
  return validMoves.includes(newcoord);
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

/**
 * Returns an array of all coordinates the given piece can move to in the given matchState.
 * @param {JSON} matchState - Match data, containing the last move and piece placements
 * @param {JSON} piece - Piece data regarding it's placement, color, and type
 * @return {array} String array of all coordinates the piece can move to
 */
function getMoveSet(matchState, piece) {
  let moveSet = [];
  let file = piece['position'].substring(0, 1);
  let rank = parseInt(piece['position'].substring(1));
  if (piece['type'] === 'pawn') {
    let forwardTwo = file;
    let upRank = rank;
    if (piece['color'] === 'white') {
      upRank += 1;
      forwardTwo += (upRank + 1);
    } else {
      upRank -= 1;
      forwardTwo += (upRank - 1);
    }
    let forwardOne = file + upRank;
    let diagLeft = String.fromCharCode(file.charCodeAt(0) - 1) + upRank;
    let diagRight = String.fromCharCode(file.charCodeAt(0) + 1) + upRank;
    moveSet.push(forwardOne);
    if (rank === 2 || rank === BOARD_SIZE - 1) {
      moveSet.push(forwardTwo);
    }
    if (file !== 'a') {
      moveSet.push(diagLeft);
    }
    if (file !== 'h') {
      moveSet.push(diagRight);
    }
  }
  return moveSet;
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
 * Returns an array of JSON object pieces of the given color.
 * @param {string} color - Color of pieces
 * @return {array} Array of JSON objects representing pieces
 */
function initPieces(color) {
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
    pieces[i] = initPiece(color, 'pawn', file + pawnRow);
    pieces[i + BOARD_SIZE] = initPiece(color, getBackRow(i), file + backRow);
  }
  return pieces;
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
 * Returns a JSON object representing a piece, with the given attributes.
 * @param {string} color - Color of piece
 * @param {string} type - Type of piece
 * @param {string} position - Position of piece
 * @return {string} Name of piece
 */
function initPiece(color, type, position) {
  let piece = {
    "color": color,
    "type": type,
    "status": "alive",
    "position": position
  };
  return piece;
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
    if (piece['status'] !== 'dead') {
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
