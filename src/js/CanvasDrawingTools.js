mindmaps.CanvasDrawingUtil = {
	/**
	 * Calculates the width of a branch for a node for the given depth
	 * 
	 * @param {Integer} depth the depth of the node
	 * @returns {Number}
	 */
	getLineWidth : function(zoomFactor, depth) {
		// var width = this.zoomFactor * (10 - depth);
		var width = zoomFactor * (12 - depth * 2);

		if (width < 2) {
			width = 2;
		}

		return width;
	}
};

/**
 * Object that draws the line connection (the branch) between two nodes onto a
 * canvas object.
 * 
 * @constructor
 */
mindmaps.CanvasBranchDrawer = function() {
	/**
	 * Callback during render() method. Is called after calculating the
	 * boundaries of the line and before actual drawing.
	 * 
	 * @event
	 */
	this.beforeDraw = function(width, height, left, top) {

	};

	/**
	 * Render.
	 * 
	 * @param {Context} ctx
	 * @param {Integer} depth
	 * @param {Number} offsetX
	 * @param {Number} offsetY
	 * @param {jQuery} $node
	 * @param {jQuery} $parent
	 * @param {String} color
	 * @param {Number} zoomFactor
	 */
	this.render = function(ctx, depth, offsetX, offsetY, $node, $parent, color,
			zoomFactor) {

		offsetX = offsetX * zoomFactor;
		offsetY = offsetY * zoomFactor;

		var pw = $parent.width();
		var nw = $node.width();
		var pih = $parent.innerHeight();
		var nih = $node.innerHeight();

		// line is drawn from node to parent
		// draw direction
		var leftToRight, topToBottom;

		// node overlaps with parent above or delow
		var overlap = false;

		// canvas attributes
		var left, top, width, height;
		var bColor;

		// position relative to parent
		var nodeLeft = offsetX + nw / 2 < pw / 2;
		if (nodeLeft) {
			var aOffsetX = Math.abs(offsetX);
			if (aOffsetX > nw) {
				// normal left

				// make it one pixel too wide to fix firefox rounding issues
				width = aOffsetX - nw + 1;
				left = nw;
				leftToRight = true;

				// bColor = "red";
			} else {
				// left overlap
				left = -offsetX;
				width = nw + offsetX;
				leftToRight = false;
				overlap = true;

				// bColor = "orange";
			}
		} else {
			if (offsetX > pw) {
				// normal right

				// make it one pixel too wide to fix firefox rounding issues
				width = offsetX - pw + 1;
				left = pw - offsetX;
				leftToRight = false;

				// bColor = "green";
			} else {
				// right overlap
				width = pw - offsetX;
				left = 0;
				leftToRight = true;
				overlap = true;

				// bColor = "yellow";
			}
		}

		var lineWidth = mindmaps.CanvasDrawingUtil.getLineWidth(zoomFactor,
				depth);
		var halfLineWidth = lineWidth / 2;

		// avoid zero widths
		if (width < lineWidth) {
			width = lineWidth;
		}

		var nodeAbove = offsetY + nih < pih;
		if (nodeAbove) {
			top = nih;
			height = $parent.outerHeight() - offsetY - top;

			topToBottom = true;
		} else {
			top = pih - offsetY;
			height = $node.outerHeight() - top;

			topToBottom = false;
		}

		// fire before draw event
		this.beforeDraw(width, height, left, top);

		// determine start and end coordinates
		var startX, startY, endX, endY;
		if (leftToRight) {
			startX = 0;
			endX = width;
		} else {
			startX = width;
			endX = 0;
		}

		// calculate difference in line width to parent node
		// and position line vertically centered to parent line
		var pLineWidth = mindmaps.CanvasDrawingUtil.getLineWidth(zoomFactor,
				depth - 1);
		var diff = (pLineWidth - lineWidth) / 2;

		if (topToBottom) {
			startY = 0 + halfLineWidth;
			endY = height - halfLineWidth - diff;
		} else {
			startY = height - halfLineWidth;
			endY = 0 + halfLineWidth + diff;
		}

		// calculate bezier points
		if (!overlap) {
			var cp2x = startX > endX ? startX / 5 : endX - (endX / 5);
			var cp2y = endY;

			var cp1x = Math.abs(startX - endX) / 2;
			var cp1y = startY;
		} else {
			// node overlaps with parent

			// take left and right a bit away so line fits fully in canvas
			if (leftToRight) {
				startX += halfLineWidth;
				endX -= halfLineWidth;
			} else {
				startX -= halfLineWidth;
				endX += halfLineWidth;
			}

			// reversed bezier for overlap
			var cp1x = startX;
			var cp1y = Math.abs(startY - endY) / 2;

			var cp2x = endX;
			var cp2y = startY > endY ? startY / 5 : endY - (endY / 5);
		}

		// draw
		ctx.lineWidth = lineWidth;
		ctx.strokeStyle = color;
		ctx.fillStyle = color;

		ctx.beginPath();
		ctx.moveTo(startX, startY);
		ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
		ctx.stroke();

		var drawControlPoints = false;
		if (drawControlPoints) {
			// control points
			ctx.beginPath();
			ctx.fillStyle = "red";
			ctx.arc(cp1x, cp1y, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = "green";
			ctx.arc(cp2x, cp2y, 4, 0, Math.PI * 2);
			ctx.fill();
		}
	};
};

/**
 * Utitility object that calculates how much space a text would take up in a
 * node. This is done through a dummy div that has the same formatting as the
 * node and gets the text injected.
 * 
 * @constructor
 * @param {mindmaps.CanvasView} view
 */
mindmaps.TextMetrics = function(view) {
	var $div = $("<div/>", {
		id : "text-metrics-dummy",
		"class" : "node-text-behaviour"
	}).css({
		position : "absolute",
		visibility : "hidden",
		height : "auto",
		width : "auto"
	}).appendTo(view.$getContainer());

	/**
	 * Calculates the width and height a node would have to provide to show the
	 * text.
	 * 
	 * @param {mindmaps.Node} node the node whose text is to be measured.
	 * @param {mindmaps.Node} [text] use this instead of the text of node
	 * @returns {Object} object with properties width and height.
	 */
	this.getTextMetrics = function(node, text) {
		text = text || node.getCaption();
		var font = node.text.font;
		var minWidth = node.isRoot() ? mindmaps.TextMetrics.ROOT_CAPTION_MIN_WIDTH
				: mindmaps.TextMetrics.NODE_CAPTION_MIN_WIDTH;
		var maxWidth = mindmaps.TextMetrics.NODE_CAPTION_MAX_WIDTH;

		$div.css({
			"font-size" : view.zoomFactor * font.size,
			"min-width" : view.zoomFactor * minWidth,
			"max-width" : view.zoomFactor * maxWidth,
			"font-weight" : font.weight
		}).text(text);

		// add some safety pixels for firefox, otherwise it doesnt render
		// right on textareas
		var w = $div.width() + 2;
		var h = $div.height() + 2;

		return {
			width : w,
			height : h
		};
	};
};

/**
 * @constant
 */
mindmaps.TextMetrics.ROOT_CAPTION_MIN_WIDTH = 100;

/**
 * @constant
 */
mindmaps.TextMetrics.NODE_CAPTION_MIN_WIDTH = 70;

/**
 * @constant
 */
mindmaps.TextMetrics.NODE_CAPTION_MAX_WIDTH = 150;