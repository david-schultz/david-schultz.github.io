
"use strict";
(function() {
  /** @global */

  window.addEventListener("load", init);

  /** Initializes the document/window with a background image. */
  function init() {
    let selectTip = id("select-tip");
    let leftSelect = id("left-select");
    let rightSelect = id("right-select");

    leftSelect.addEventListener("click", selectLeft);
    rightSelect.addEventListener("click", selectRight);

    selectLeft();
  }

  function selectLeft() {
    let selectTip = id("select-tip");
    let leftSelect = id("left-select");
    let rightSelect = id("right-select");
    console.log('left');

    leftSelect.classList.add("selected");
    rightSelect.classList.remove("selected");
  }

  function selectRight() {
    let selectTip = id("select-tip");
    let leftSelect = id("left-select");
    let rightSelect = id("right-select");
    console.log('right');


    rightSelect.classList.add("selected");
    leftSelect.classList.remove("selected");
    // element.classList.add("selected");

  }

  function id(idName) {
    return document.getElementById(idName);
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return document.querySelectorAll(selector);
  }

  function gen(tagName) {
    return document.createElement(tagName);
  }
})();
