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
app.get('/chess/newboard', async function(req, res) {
  res.type('json');
  res.send(await writeNewMatch());
});

async function writeNewMatch() {
//   const db = await getDBConnection();
//   let sql = 'INSERT INTO matches (next_move, in_check) VALUES (?, ?)';
//   let id = (await db.run(sql, ['white', 'none'])).lastID;
//   await db.close();
//   let match = {
//     'match-id': id,
//     'pieces': combineArrays(await initPieces('white', id), await initPieces('black', id))
//   };
//   curMatchId = id;
//   return match;
  // let boardId = 99;

  let board = new Board();
  await board.init();
  let match = {
    'board-id': board.id,
    'pieces': board.active
  };
  return match;
}

class Board {
  constructor() {
    this.turnNumber = 0;
    this.active = this.initializePieces();
    this.captured = [];
    this.history = []; //2d array
  }

  async init() {
    const db = await getDBConnection();
    let sql = 'INSERT INTO boards (turn_number) VALUES (?)';
    this.id = (await db.run(sql, [0])).lastID;
    for (let i = 0; i < this.active.length; i++) {
      let piece = this.active[i];
      if (piece !== undefined) {
        sql = 'INSERT INTO pieces (type, color, position, board_id) VALUES (?, ?, ?, ?)';
        piece.updateId((await db.run(sql, [piece.type, piece.color, piece.position, this.id])).lastID);
        sql = 'INSERT INTO active (piece_id, board_id) VALUES (?, ?)';
        await db.run(sql, [piece.id, this.id]);
      }
    }
    await db.close();
  }


  async load(id) {
    const db = await getDBConnection();
    let sql = 'SELECT turn_number FROM boards WHERE id = ?';
    this.turnNumber = await db.all(sql, [id]);
    sql = 'SELECT pieces.id, pieces.type, pieces.color, pieces.position ' +
          'FROM pieces, active ' +
          'WHERE active.piece_id = pieces.id AND pieces.board_id = ?';
    let active = await db.all(sql, [id]);
    sql = 'SELECT pieces.id, pieces.type, pieces.color, pieces.position ' +
          'FROM pieces, captured ' +
          'WHERE captured.piece_id = pieces.id AND pieces.board_id = ?';
    let captured = await db.all(sql, [id]);
    sql = 'SELECT turn_number, white_move, black_move FROM history WHERE board_id = ?';
    let history = await db.all(sql, [id]);

    console.log(active);
    console.log(' ');
    console.log(captured);
    console.log(' ');
    console.log(history);

    for (let i = 0; i < active.length; i++) {
      this.active[i] = new Piece(active['type'], active['color'], active['position']);
      this.active[i].updateId(active['id']);
    }


    // for (let i = 0; i < this.active.length; i++) {
    //   let piece = this.active[i];
    //   console.log(piece);
    //   if (piece !== undefined) {
    //     sql = 'INSERT INTO pieces (type, color, position, board_id) VALUES (?, ?, ?, ?)';
    //     piece.updateId((await db.run(sql, [piece.type, piece.color, piece.position, this.id])).lastID);
    //     sql = 'INSERT INTO active (piece_id, board_id) VALUES (?, ?)';
    //     await db.run(sql, [piece.id, this.id]);
    //   }
    // }
    await db.close();
  }


  pieceAt(position) {
    return this.active[position];
  }

  checkMoveSet(pos) {
    let curHistory = this.history[this.turnNumber];
    let moveSet;
    if (curHistory === undefined || curHistory[0].getTargetPosition() === "") { // meaning it's white's move
      curHistory = [new Move(this.pieceAt(pos), this)];
      moveSet = curHistory[0].getPossibleMoves();
    } else {
      curHistory[1] = new Move(this.pieceAt(pos), this);
      moveSet = curHistory[1].getPossibleMoves();
    }
    this.history[this.turnNumber] = curHistory;
    return moveSet;
  }

  move(pos1, pos2) {
    let boundsCondition = (pos1 < 0 || pos1 > 63) || (pos2 < 0 || pos2 > 63);
    let color = this.history[this.turnNumber][0].getTargetPosition() === "";
    if (boundsCondition || this.pieceAt(pos1) === null || this.pieceAt(pos1).color() === color) {
      return false;
    }
    let curMove;
    if (color) {
      curMove = this.history[this.turnNumber][0];
    } else {
      curMove = this.history[this.turnNumber][1];
    }

    if (curMove.getPossibleMoves().contains(pos2)) {
      curMove.makeMove(pos2);
      if (pieceAt(pos2) !== null) {
        this.captured.push(pieceAt(pos2));
        this.active[pos2] = null;
      }
    }

    if (!color) {
      moveNumber++;
    }
    return true;
  }

  initializePieces() {
    let pieces = [];
    // white pieces
    pieces[0] = new Piece('R', true, 0);
    pieces[1] = new Piece('N', true, 1);
    pieces[2] = new Piece('B', true, 2);
    pieces[3] = new Piece('Q', true, 3);
    pieces[4] = new Piece('K', true, 4);
    pieces[5] = new Piece('B', true, 5);
    pieces[6] = new Piece('N', true, 6);
    pieces[7] = new Piece('R', true, 7);
    for (let i = 8; i < 16; i++) {
      pieces[i] = new Piece('P', true, i);
    }

    // black pieces
    for (let i = 48; i < 56; i++) {
      pieces[i] = new Piece('P', false, i);
    }
    pieces[56] = new Piece('R', false, 56);
    pieces[57] = new Piece('N', false, 57);
    pieces[58] = new Piece('B', false, 58);
    pieces[59] = new Piece('Q', false, 59);
    pieces[60] = new Piece('K', false, 60);
    pieces[61] = new Piece('B', false, 61);
    pieces[62] = new Piece('N', false, 62);
    pieces[63] = new Piece('R', false, 63);

    return pieces;
  }
}

/* type() | p, r, n, b, q, k
 * color() | true(white), false(black)
 * position() | int from 0-63
 */
class Piece {
  constructor(type, color, position) {
    this.type = type;
    this.color = color;
    this.position = position;
  }

  updateId(id) {
    this.id = id;
  }
}

class Move {
  constructor(piece, board) {
    this.piece = piece;
    this.board = board;
    this.targetPosition = "";
  }

  getTargetPosition() {
    return this.targetPosition;
  }

  getPossibleMoves() {
    let moves = [];
    for (let i = 0; i < 64; i++) {
      moves[i] = i;
    }
  }

  makeMove(position) {
    if (this.targetPosition === "") {

    }
    let notation = "";
    if (this.piece.type !== 'P') {
      notation += this.piece.type;
    }
    notation += convertNotation(this.targetPosition);
    return notation;
  }
}


app.get('/chess/getmoves', async function(req, res) {
  let position = req.query.position;
  let boardId = req.query.boardid;

  let board = new Board();
  await board.load(boardId);

  // const db = await getDBConnection();
  // let sql = 'SELECT type, color, position_rank, position_file, alive FROM pieces WHERE match_id = ?';
  // let allPieces = await db.all(sql, boardId);
  // sql = 'SELECT type, color, position, position_rank, position_file FROM pieces WHERE match_id = ? AND position = ?'
  // let selectedPiece = await db.all(sql, [matchId, position]);
  // await db.close();

  res.json(moveSet);
});

function convertNotation(squareID) {
  let file = String.fromCharCode(97 + (squareID % 8) + 1); //a-h
  let rank = (squareID / 8) + 1; //1-8
  return "" + file + rank;
}
//
// /**
//  * POST endpoint which sends a text response detailing the positions of each piece,
//  * separated by color.
//  * @param {obj} req - Request sent to endpoint
//  * @param {obj} res - Response sent back to client
//  * @return {JSON} Match data about initial chess piece placements
//  */
// app.post('/chess/pieces', function(req, res) {
//   res.type('text');
//   let matchId = req.body.matchid;
//   if (parseInt(boardState['match-id']) !== parseInt(matchId)) {
//     res.status(CLIENT_ERROR_CODE).send('Invalid POST parameter: matchid');
//   } else {
//     res.send(pieceList(boardState['match-state']));
//   }
// });
//
// /**
//  * POST endpoint which receives a match id, and two coordinates which represent
//  * a piece's coordinate, and the coordinate to move to.
//  * Sends back an updated JSON matchstate.
//  * @param {obj} req - Request sent to endpoint
//  * @param {obj} res - Response sent back to client
//  * @return {JSON} Match data containing new chess piece placements, and the last move
//  */
// app.post('/chess/move', async function(req, res) {
//   let matchId = req.body.matchid;
//   let coord = req.body.coord;
//   let newCoord = req.body.newcoord;
//
//   res.json(match);
//   await db.close();
// });
//

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
