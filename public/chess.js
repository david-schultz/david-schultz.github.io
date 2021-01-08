/*
 * Name: David Schultz
 * Date: 11.20.2020
 * Section: CSE 154 AF / Wilson Tang
 *
 * This file access the chess API, which updates and returns information about
 * a chess match, depending on moves sent to it.
 *
 * Chess piece icons obtained from wikimedia commons: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
 */

"use strict";
(function() {
  /** @global */
  const BOARD_SIZE = 8;
  const A_CHAR_CODE = 96;

  window.addEventListener("load", init);

  /** Initializes the page with a fresh chess board, filled with pieces. */
  function init() {
    reqNewMatch();
  }

  /**
   * Sends a GET request to the chess API at the /chess/getmatch endpoint, in
   * order to obtain piece positions on a new match.
   */
  function reqNewMatch() {
    fetch('/chess/getmatch')
      .then(checkStatus)
      .then(res => res.json())
      .then(initializeMatch)
      .catch(handleError);
  }

  /**
   * Sends a POST request to the chess API at the /chess/move endpoint.
   * Sends the function's parameters as POST parameters.
   * @param {string} matchId - Match id to assign to board
   * @param {string} curCoord - Coordinates of selected piece to move
   * @param {string} newCoord - Coordinate of selected piece's destination
   */
  function reqMove(matchId, curCoord, newCoord) {
    console.log('requesting move from ' + curCoord + ' to ' + newCoord);
    let parameters = new FormData();
    parameters.append('matchid', matchId);
    parameters.append('coord', curCoord);
    parameters.append('newcoord', newCoord);
    fetch('/chess/move', {
      method: 'POST',
      body: parameters
    })
      .then(checkStatus)
      .then(res => res.json())
      .then(makeMove)
      .catch(handleError);
  }

  function reqMoveSet(position) {
    removePotentialMoveDisplay();
    fetch('/chess/getmoves?position=' + position + '&match_id=' + localStorage.getItem('match_id'))
      .then(checkStatus)
      .then(res => res.json())
      .then(processMoveSet)
      .catch(handleError);
  }

  function processMoveSet(res) {
    for (let i = 0; i < res.length; i++) {
      let tile = id(res[i]).children[0];
      let img = gen('img');
      img.src = 'photos/chess/potential-';
      img.alt = 'potential move';
      img.className = 'potential-move';
      if (tile.children.length === 0) {
        img.src += 'move.png';
      } else {
        img.src += 'take.png';
      }
      tile.appendChild(img);


    }
  }

  function removePotentialMoveDisplay() {
    let imgs = qsa('.potential-move');
    for (let i = 0; i < imgs.length; i++) {
      imgs[i].parentNode.removeChild(imgs[i]);
    }
  }

  /**
   * Sends a POST request to the chess API at the /chess/pieces endpoint.
   * Updates the DOM's piece-list with API's response.
   * @param {string} matchId - Match id to assign to board
   */
  function reqPieceList(matchId) {
    let parameters = new FormData();
    parameters.append('matchid', matchId);
    fetch('/chess/pieces', {
      method: 'POST',
      body: parameters
    })
      .then(checkStatus)
      .then(res => res.text())
      .then(res => {
        // id('piece-list').textContent = res;
      })
      .catch(handleError);
  }

  /**
   * Manages response from GET request for a new match. Updates chess board
   * with the response.
   * @param {obj} res - Rseponse from chess API
   */
  function initializeMatch(res) {
    console.log(res);
    let board = createBoard(res['match-id']);
    id('game-view').appendChild(board);
    window.localStorage.setItem('match_id', res['match-id']);
    console.log(window.localStorage.getItem('match_id'));
    let pieces = res['pieces'];
    addAllPieces(pieces);
  }

  /**
   * Manages response from POST request for a new move. Updates chess board if
   * the posted move is valid.
   * @param {obj} res - Response from chess API
   */
  function makeMove(res) {
    if (res['valid']) {
      let origCoord = res['last-move']['coord'];
      let newCoord = res['last-move']['new-coord'];
      let img = id(origCoord).children[0].children[0];
      id(newCoord).children[0].appendChild(img);
      reqPieceList(document.querySelector('.board').id);
    }
  }

  /**
   * Creates a table element representing a chess board with coordinates.
   * @param {string} matchId - Match id to assign to board
   * @return {obj} DOM table element representing a chess board.
   */
  function createBoard(matchId) {
    let board = gen('table');
    board.className = 'board';
    board.id = matchId;
    for (let i = 0; i < BOARD_SIZE + 1; i++) {
      let rank = gen('tr');
      for (let j = 0; j < BOARD_SIZE + 1; j++) {
        let cell;
        if (i === BOARD_SIZE || j === 0) {
          cell = gen('th');
        } else {
          let id = String.fromCharCode(A_CHAR_CODE + j) + (BOARD_SIZE - i);
          cell = gen('td');
          cell.id = id;
          if ((i + j) % 2 === 0) {
            cell.appendChild(getTile('dark'));
          } else {
            cell.appendChild(getTile('light'));
          }
          cell.addEventListener('click', squareClicked);
        }
        rank.appendChild(cell);
      }
      board.appendChild(rank);
    }
    addCoord(board);
    return board;
  }

  /**
   * Checks for and posts a move to the chess API, and visually updates the
   * chess board to represent it.
   */
  function squareClicked() {
    if (this.children[0].classList.contains('selected')) {
      clearAllSelected();
    }
    let tile = this.children[0];
    let containsPiece = false;
    let containsMove = false;
    for (let i = 0; i < tile.children.length; i++) {
      if (tile.children[i].className === 'piece') {
        containsPiece = true;
      } else if (tile.children[i].className === 'potential-move') {
        containsMove = true;
      }
    }
    // scenarios
    // 1. a piece is currently selected
    //  - selected square has a potential-move on it
    //  -
    // 2. a piece is not currently selected
    //  - selected square has piece on it
    //
    //

    if (id('current-selection').textContent === '') {
      if (containsPiece) {
        clearAllSelected();
        reqMoveSet(this.id);
        this.children[0].classList.add('selected');
        id('current-selection').textContent = this.id;
      }
    } else {
      if (containsMove) {
        let matchId = localStorage.getItem('match_id');
        reqMove(matchId, id('current-selection').textContent, this.id);
      } else if (containsPiece) {
        clearAllSelected();
        reqMoveSet(this.id);
        this.children[0].classList.add('selected');
        id('current-selection').textContent = this.id;
      }
      id('current-selection').textContent = '';
    }
    //
    // if (this.children[0].children[0]) {
    //   let div = this.children[0];
    //   let flag = false;
    //   for (let i = 0; i < div.children.length; i++) {
    //     if (div.children[i].className === 'potential-move') {
    //       flag = true;
    //     }
    //   }
    //   if (flag) { // if the clicked square has a potential move on it
    //     reqMove(document.localStorage.getItem('match_id'), id('current-selection').textContent, this.id);
    //   } else { // if the clicked square has nothing on it
    //     reqMoveSet(this.id);
    //
    //   }
    //   clearAllSelected();
    //   this.children[0].classList.add('selected');
    //   id('current-selection').textContent = this.id;
    // } else if (id('current-selection').textContent !== '') {
    //   let div = this.children[0];
    //   let flag = false;
    //   for (let i = 0; i < div.children.length; i++) {
    //     if (div.children[i].className === 'potential-move') {
    //       flag = true;
    //     }
    //   }
    //
    //     console.log(this.id);
    //   if (flag) {
    //
    //   }
    //   id('current-selection').textContent = '';
    //   // this.children[0].classList.add('selected');
    // }
    //

  }

  /**
   * Removes the selected class from every DOM element on the page.
   */
  function clearAllSelected() {
    let selectedElements = qsa('.selected');
    for (let i = 0; i < selectedElements.length; i++) {
      selectedElements[i].classList.remove('selected');
    }
  }

  /**
   * Returns a new DOM element representing a chess board tile, given a color.
   * @param {string} bgColor - 'dark' or 'light', for the color of tile
   * @return {obj} DOM element representing a chess tile
   */
  function getTile(bgColor) {
    let tile = gen('div');
    tile.className = 'tile ' + bgColor + '-tile';
    return tile;
  }

  /**
   * Given a board, assuming that the left column and bottom row are <th> elements,
   * adds visual coordinates to each <th> element.
   * @param {obj} board - DOM <table> element representing the chess board
   */
  function addCoord(board) {
    for (let i = 0; i < BOARD_SIZE + 1; i++) {
      let file = board.children[BOARD_SIZE - i].children[0];
      let rank = board.children[BOARD_SIZE].children[i];

      let fileCoord = i;
      let rankCoord = String.fromCharCode(A_CHAR_CODE + i);
      if (i === 0) {
        rankCoord = '';
        fileCoord = '';
      }
      file.appendChild(getCoordP(fileCoord));
      rank.appendChild(getCoordP(rankCoord));
    }
  }

  /**
   * Returns a DOM <p> element containing the given coordinate string.
   * @param {string} coordinate - Contains the rank or file coordinate
   * @return {obj} DOM element representing a coordinate
   */
  function getCoordP(coordinate) {
    let pTag = gen('p');
    pTag.textContent = coordinate;
    return pTag;
  }

  /**
   * Adds all given pieces to chess board.
   * @param {array} pieces - array containing json objects representing chess pieces
   */
  function addAllPieces(pieces) {
    for (let i = 0; i < pieces.length; i++) {
      let piece = pieces[i];
      let cell = id(piece['position']);
      let img = gen('img');
      img.src = 'photos/chess/';
      img.src += piece['color'] + '-' + piece['type'] + '.png';
      img.alt = piece['color'] + ' ' + piece['type'];
      img.className = 'piece';
      cell.children[0].appendChild(img);
    }
  }

  /**
   * Confirms that the fetched response is valid.
   * @param {obj} res - Response from the api call.
   * @return {obj} Response from api call.
   */
  async function checkStatus(res) {
    if (!res.ok) {
      throw new Error(await res.text());
    }
    return res;
  }

  /**
   * Throws the given error.
   * @param {obj} error - Error from fetch chain.
   */
  function handleError(error) {
    throw error;
  }

  /**
   * Returns the DOM element with the given id.
   * @param {string} idName - id name to search for.
   * @return {obj} DOM element corresponding to given id.
   */
  function id(idName) {
    return document.getElementById(idName);
  }

  /**
   * Returns an array of DOM elements with the given query.
   * @param {string} query - query to search for.
   * @return {obj} DOM element array corresponding to given query.
   */
  function qsa(query) {
    return document.querySelectorAll(query);
  }

  /**
   * Returns a new DOM element of the given tag name.
   * @param {string} tagName - Tag name of element to create.
   * @return {obj} DOM element of given tag name.
   */
  function gen(tagName) {
    return document.createElement(tagName);
  }
})();
