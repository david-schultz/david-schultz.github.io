/*
 * Name: David Schultz
 * Date: 10.21.2020
 * Section: CSE 154 AF / Wilson Tang
 *
 * This is the main js file to handle photography.html functionality. Inside is
 * an implementation of a Deque object, and a Photo object to easily handle DOM
 * manipulation.
 *
 * This file would be named `photography.js`, but because of the linter I had to
 * name it `index.js`. Lame.
 */

"use strict";
(function() {
  /** @global */
  const DIR = "photos/";
  const LENGTH = 123;
  let curPhoto;
  let photoList;
  let likeList;

  /**
   * Deque implementation based on array functions seen at alligator.io:
   * https://alligator.io/js/push-pop-shift-unshift-array-methods/
   * A deque is a double-ended queue, essentially allowing for easy "back-n-forth" traversal.
   */
  class Deque {

    /** Constructs a deque object. */
    constructor() {
      this.items = [];
    }

    /**
     * Adds the given element e to the front of the deque.
     * @param {obj} element - object to add to deque
     * @returns {int} new deque length
     */
    addFront(element) {
      return this.items.unshift(element);
    }

    /**
     * Removes the first element in the deque.
     * @returns {(obj|string)} removed object, or "Underflow".
     */
    removeFront() {
      if (this.isEmpty()) {
        return "Underflow";
      }
      return this.items.shift();
    }

    /**
     * Returns the first element in the deque.
     * @returns {(obj|string)} first element in deque, or "Underflow".
     */
    peekFront() {
      if (this.isEmpty()) {
        return "queue empty";
      }
      return this.items[0];
    }

    /**
     * Adds the given element e to the end of the deque.
     * @param {obj} element - object to add to deque
     * @returns {int} new deque length
     */
    addBack(element) {
      return this.items.push(element);
    }

    /**
     * Removes the last element in the deque.
     * @returns {(obj|string)} removed object, or "Underflow".
     */
    removeBack() {
      if (this.isEmpty()) {
        return "Underflow";
      }
      return this.items.pop();
    }

    /**
     * Returns the last element in the deque.
     * @returns {(obj|string)} last element in deque, or "Underflow".
     */
    peekBack() {
      if (this.isEmpty()) {
        return "queue empty";
      }
      return this.items[this.items.length];
    }

    /**
     * Removes the given element from the deque, if the deque contains it.
     * @param {obj} element - element to remove
     */
    remove(element) {
      if (!this.contains(element)) {
        if (element === this.peekFront()) {
          this.removeFront();
        } else if (element === this.peekBack()) {
          this.removeBack();
        } else {
          let front = new Deque();
          let curE = this.items[0];
          while (element !== curE) {
            front.addBack(this.removeFront());
            curE = this.items[0];
          }
          this.removeFront();
          for (let i = 0; i < front.length; i++) {
            this.addFront(front.removeBack());
          }
        }
      }
    }

    /**
     * Returns a boolean, indicating whether the given element is in the deque.
     * @param {obj} element - element to look for
     * @returns {bool} boolean indicating if the deque contains the given element
     */
    contains(element) {
      for (let i = 0; i < this.items.length; i++) {
        if (element === this.items[i]) {
          return true;
        }
      }
      return false;
    }

    /**
     * Returns an element in the deque with the same id given.
     * @param {string} identification - id to check for
     * @returns {(obj|string)} element with given id, or "no id found"
     */
    getFromId(identification) {
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].id === identification) {
          return this.items[i];
        }
      }
      return "no id found";
    }

    /**
     * Returns a boolean, indicating whether the deque is empty or not.
     * @returns {bool} indicates if the deque's length is 0 or not
     */
    isEmpty() {
      return this.items.length === 0;
    }
  }

  /**
   * Class representing a photo and relevant metadata.
   */
  class Photo {

    /**
     * Creates a photo object with a given name.
     * @param {string} name - name of the photo
     */
    constructor(name) {
      this.name = name;
    }

    /**
     * Returns a path for an img src.
     * @returns {string} path relating to photo
     */
    get path() {
      return DIR + this.name + ".jpg";
    }

    /**
     * Returns an id consisting of "photo-" and the name.
     * @returns {string} "photo-" + photo name
     */
    get id() {
      return "photo-" + this.name;
    }
  }

  window.addEventListener("load", init);

  /** Initializes the document/window with a background image. */
  function init() {
    photoList = newPhotoList(LENGTH);
    likeList = new Deque();
    curPhoto = photoList.peekFront();
    setPhoto(curPhoto);
    initButtons();
    let showcase = id("showcase");
    showcase.addEventListener("click", function() {
      showcasePhoto(likeList.getFromId(this.children[0].id));
      unhighlight();
    });
  }

  /** Initializes photo navigation buttons with respective event listeners. */
  function initButtons() {
    let likeButton = id("like-button");
    let prevButton = id("prev-button");
    let nextButton = id("next-button");
    likeButton.addEventListener("click", likePhoto);
    prevButton.addEventListener("click", prevPhoto);
    nextButton.addEventListener("click", nextPhoto);
  }

  /**
   * Replaces the background image with the given photo.
   * @param {photo} photo - photo object.
   */
  function setPhoto(photo) {
    let bg = qs(".photo-bg");
    bg.style.backgroundImage = "url(\"" + photo.path + "\")";
    curPhoto = photo;
  }

  /**
   * Configures the showcase to either show or hide the given photo.
   * If the showcase is invisible, or a new photo is given, it will return the
   * showcase to a visible state and display the given photo.
   * If the showcase is already visible, and contains the given photo, it will
   * turn the showcase to an invisible state.
   * @param {photo} photo - photo object
   */
  function showcasePhoto(photo) {
    let img = id("showcase").children[0];
    if (img.classList.contains("invisible")) {
      displayShowcase("visible", "invisible");
    } else if (img.id === photo.id) {
      displayShowcase("invisible", "visible");
    }
    img.src = photo.path;
    img.id = photo.id;
  }

  /**
   * Adds and removes the following parameters as classes to the showcase > img.
   * @param {string} add - class to add
   * @param {string} remove - class to remove
   */
  function displayShowcase(add, remove) {
    let img = id("showcase").children[0];
    img.classList.add(add);
    img.classList.remove(remove);
  }

  /**
   * Adds the currently displayed image to likeList. Removes it photoList, and
   * replaces the currently displayed image with the next one in photoList.
   */
  function likePhoto() {
    if (!likeList.contains(curPhoto)) {
      let container = id('liked');
      let card = gen('div');
      let photo = gen('img');
      card.classList.add('card');
      card.id = curPhoto.id;
      photo.classList.add('card-image');
      photo.src = curPhoto.path;
      photo.alt = "portfolio display photo";
      card.addEventListener("click", function() {
        highlight(this);
        showcasePhoto(likeList.getFromId(this.id));
      });
      card.appendChild(photo);
      container.appendChild(card);
      likeList.addBack(curPhoto);
      photoList.removeFront();
      setPhoto(photoList.peekFront());
    }
  }

  /**
   * Moves the last element in photoList to the front. Replaces the displayed
   * photo with the new first element.
   */
  function prevPhoto() {
    photoList.addFront(photoList.removeBack());
    setPhoto(photoList.peekFront());
  }

  /**
   * Moves the first element in photoList to the back. Replaces the displayed
   * photo with the new first element.
   */
  function nextPhoto() {
    photoList.addBack(photoList.removeFront());
    setPhoto(photoList.peekFront());
  }

  /**
   * Toggles a border around the given DOM element.
   * @param {object} card - selected DOM element
   */
  function highlight(card) {
    if (card.classList.contains("highlighted")) {
      card.classList.remove("highlighted");
    } else {
      unhighlight();
      card.classList.add("highlighted");
    }
  }

  /** Removes the highlighted border from each liked image card. */
  function unhighlight() {
    let container = id('liked');
    for (let i = 0; i < container.children.length; i++) {
      container.children[i].classList.remove("highlighted");
    }
  }

  /**
   * Returns a default deque of photos containing photos 1.jpg, 2.jpg, ..., n.jpg.
   * @param {int} length - number of photos
   * @returns {deque} new Deque containing (length) photos.
   */
  function newPhotoList(length) {
    let photos = new Deque();
    for (let i = 1; i <= length; i++) {
      photos.addBack(new Photo(i));
    }
    return photos;
  }

  /**
   * Returns the DOM object with the given id attribute.
   * @param {string} idName - element ID
   * @returns {object} DOM object associated with id (null if not found).
   */
  function id(idName) {
    return document.getElementById(idName);
  }

  /**
   * Returns the first DOM object that matches the given selector.
   * @param {string} selector - query selector.
   * @returns {object} The first DOM object matching the query.
   */
  function qs(selector) {
    return document.querySelector(selector);
  }

  /**
   * Returns a new element with the given tag name.
   * @param {string} tagName - HTML tag name for new DOM element.
   * @returns {object} New DOM object for given HTML tag.
   */
  function gen(tagName) {
    return document.createElement(tagName);
  }
})();
