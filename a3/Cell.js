"use strict";
var LIB_PATH = "./";
require(LIB_PATH + "Config.js");

function Cell () {
	var cellId = undefined;
	var ships = {};
	var rockets = {};

	/**
	 * Return the cellId that contains the point (x, y)
	 */
	var computeCell = function (x, y) {
		var cellCol = parseInt(x / (Config.WIDTH+1) * Config.NUM_COL);
		var cellRow = parseInt(y / (Config.HEIGHT+1) * Config.NUM_ROW);
		return getCellId (cellRow, cellCol);
	}

	/**
	 * Return the cellId with the cell coordinate (i, j)
	 */
	var getCellId = function (i, j) {
		return i * Config.NUM_COL + j;
	}

	/** Constructor */
	var that = this;
	this.init = function(i, j) {
		cellId = getCellId (i, j);
	}
}

global.Cell = Cell;