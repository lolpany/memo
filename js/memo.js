/*
 *  memo
 */
function Memo() {
    /*
     *  constants
     */
    // debug mode
    this.DEBUG = true;
    // buttons
//    this.PAN_NODE_MOUSE_BUTTON = 0;
    this.DRAG_NODE_MOUSE_BUTTON = 0;
    this.CREATE_ARC_MOUSE_BUTTON = 1;
    this.DELETE_MOUSE_BUTTON = 2;
    // frame rate
	this.FRAME_RATE = 60;
    // pan
    //
    this.PAN_KEYBOARD_STEP = 100;
	this.PAN_SPEED = 600;
	this.PAN_ZONE_PART = 0.2;
	this.MARGIN = 100;
    // zoom
    this.ZOOM_KEYBOARD_FACTOR = 1.2;
    this.ZOOM_MOUSE_FACTOR = 1.2 * 1 / 120;
    this.ZOOM_TIME = 100;
    // nodes and relationships drawing
	this.NODE_MIN_WIDTH = 120;
	this.NODE_MIN_HEIGHT = 40;
    this.NODE_STROKE_COLOR = "rgb(124, 191, 0)";
    this.NODE_FOCUSED_STROKE_COLOR = "rgb(255, 0, 0)";
    this.CONNECTION_STROKE_COLOR = "rgb(255, 232, 0)";
    this.CONNECTION_WIDTH = 3;

    /*
     *  fields
     */
    this.baseViewWidth = window.innerWidth - 1;
    this.baseViewHeight = window.innerHeight - 1;
	this.paper = Raphael("memo", this.baseViewWidth, this.baseViewHeight);
	this.fillDocument();
    window.onresize = function () {
        self.fillDocument();
    };
    // view
	this.viewX = 0;
	this.viewY = 0;
    this.currentZoom = 1;
    // width/heigh
    this.widthHeightRelation = this.viewWidth / this.viewHeight;
    // zoom
    this.requestedMouseZoom = this.currentZoom;
    this.zoomTimeouts = [];
    // pan
    this.dragView = false;
    this.leftScroll = false;
    this.leftScrollTimeout = null;
    this.rightScroll = false;
    this.rightScrollTimeout = null;
    this.topScroll = false;
    this.topScrollTimeout = null;
    this.bottomScroll = false;
    this.bottomScrollTimeout = null;
    // pan bounds
    this.minX = 0;
    this.minY = 0;
    this.maxX = 0;
    this.maxY = 0;
    //
    this.ctrlPressedOnMouseDown = false;
    this.selection = [];
    this.selectedNodes = {};
    this.selectedRelationships = {};
    // to not select/deselect gripped node
    this.lastGrippedNode = null;
    this.connectionBeginElement = null;
    // drawing entities
    this.nodes = {};
    this.relationships = {};
    this.adjacencyMatrix = {};
    // serializable fields
    this.lastNodeId = 1;
    this.lastConnectionId = 1;
    this.serializableNodes = {};
    this.serializableRelationships = {};
    // self
    var self = this;
    //
    document.body.style.overflow = "hidden";
    // center view
    this.setView(this.currentZoom, this.viewX, this.viewY);

    /*
     *  user input handling
     */
    // disable scroll by middle button
    document.body.onmousedown = function (e) {
        if (e.button == 1) {
            return false;
        }
    };
    // disable browser context menu
    document.body.oncontextmenu = function () {
        return false;
    };
    // initialize canvas
    this.paper.canvas.style.backgroundColor = "#2b2b2b";
    this.paper.canvas.style.top = 0;
    this.paper.canvas.style.left = 0;
    // mouse clicks
    this.paper.canvas.onmousedown = function () {
        var button = arguments.callee.arguments[0].button;
        var x = arguments.callee.arguments[0].clientX;
        var y = arguments.callee.arguments[0].clientY;
        var ctrlKey = arguments.callee.arguments[0].ctrlKey;
        var addNodeX = arguments.callee.arguments[0].clientX * self.currentZoom + self.viewX - self.viewWidth / 2;
        var addNodeY = arguments.callee.arguments[0].clientY * self.currentZoom + self.viewY - self.viewHeight / 2;
        var clickedElement = self.paper.getElementByPoint(x, y);
        switch (button) {
            case self.DRAG_NODE_MOUSE_BUTTON:
                if (ctrlKey && clickedElement) {
                    if (clickedElement.node instanceof SVGRectElement) {
                        self.addSelectedNode(clickedElement);
                    } else if (clickedElement.node instanceof SVGPathElement) {
                        self.addSelectedRelationship(self.relationships[clickedElement.data("id")]);
                    }
                } else if (ctrlKey && !clickedElement) {
                    self.ctrlPressedOnMouseDown = true;
                    self.selection.push({x: x, y: y});
                } else if (!ctrlKey && clickedElement) {
                    self.clearSelection();
                    if (clickedElement.node instanceof SVGRectElement) {
                        self.addSelectedNode(clickedElement);
                    } else if (clickedElement.node instanceof SVGPathElement) {
                        self.addSelectedRelationship(self.relationships[clickedElement.data("id")]);
                    }
                } else if (!ctrlKey && !clickedElement) {
                    self.clearSelection();
                    self.dragView = true;
                }
                break;
            case self.CREATE_ARC_MOUSE_BUTTON:
                if (!clickedElement) {
                    clickedElement = self.addNode(addNodeX, addNodeY);
                }
                self.setConnectionBeginElement(clickedElement);
                break;
            case self.DELETE_MOUSE_BUTTON:
                if (clickedElement) {
                    switch (clickedElement.type) {
                        case "rect":
                            // TODO drag by delete mouse button problem
                            self.removeNode(clickedElement);
                            break;
                        case "text":
                            // TODO drag by delete mouse button problem
                            self.removeNode(self.nodes[clickedElement.data("nodeId")]);
                            break;
                        case "path":
                            self.removeConnection(clickedElement);
                            break;
                    }
                } else {
                    self.clearSelection();
                }
                break;
        }
    };
    this.paper.canvas.onmouseup = function () {
        var button = arguments.callee.arguments[0].button;
        var x = arguments.callee.arguments[0].clientX;
        var y = arguments.callee.arguments[0].clientY;
        var addNodeX = arguments.callee.arguments[0].clientX * self.currentZoom + self.viewX - self.viewWidth / 2;
        var addNodeY = arguments.callee.arguments[0].clientY * self.currentZoom + self.viewY - self.viewHeight / 2;
        var releasedElement = self.paper.getElementByPoint(x, y);
        switch (button) {
            case self.DRAG_NODE_MOUSE_BUTTON:
                if (self.ctrlPressedOnMouseDown) {
                    self.ctrlPressedOnMouseDown = false;
                    var pathString = "M" + (self.selection[0].x * self.currentZoom + self.viewX - self.viewWidth / 2) + " " + (self.selection[0].y* self.currentZoom + self.viewY - self.viewHeight / 2);
                    for (var i = 1; i < self.selection.length; i++) {
                        pathString += "L" + (self.selection[i].x * self.currentZoom + self.viewX - self.viewWidth / 2) + " " + (self.selection[i].y* self.currentZoom + self.viewY - self.viewHeight / 2);
                    }
                    pathString += "Z";
                    for (var nodeId in self.nodes) {
                        var node = self.nodes[nodeId];
                        var bbox = node.getBBox();
                        if (Raphael.isPointInsidePath(pathString, bbox.x, bbox.y) && Raphael.isPointInsidePath(pathString, bbox.x, bbox.y2)
                            && Raphael.isPointInsidePath(pathString, bbox.x2, bbox.y) && Raphael.isPointInsidePath(pathString, bbox.x2, bbox.y2)) {
                            if (node.data("id") in self.selectedNodes) {
                                self.removeSelectedNode(node);
                            } else {
                                self.addSelectedNode(node);
                            }
                        }
                    }
                    self.selection = [];
                } else {
                    self.dragView = false;
                }
                break;
            case self.CREATE_ARC_MOUSE_BUTTON:
                if (!releasedElement) {
                    releasedElement = self.addNode(addNodeX, addNodeY);
                }
                if ((self.getConnectionBeginElement() !== releasedElement) && (releasedElement.type === "rect")) {
                    self.addConnection(self.getConnectionBeginElement().data("id"), releasedElement.data("id"))
                }
                break;
        }
    };
    window.onmousewheel = function (e) {
        var cursorX = self.viewX - (arguments.callee.arguments[0].clientX * self.currentZoom - self.viewWidth / 2);
        var cursorY = self.viewY - (arguments.callee.arguments[0].clientY * self.currentZoom - self.viewHeight / 2);
        // up
        if (e.wheelDelta >= 0) {
            self.requestedMouseZoom /= self.ZOOM_MOUSE_FACTOR * e.wheelDelta;
            self.animateZoom(self.viewX, self.viewY);
            // down
        } else {
            self.requestedMouseZoom *= self.ZOOM_MOUSE_FACTOR * (-e.wheelDelta);
            self.animateZoom(self.viewX, self.viewY);
        }
    };
    window.onmousemove = function (e) {
		if (self.ctrlPressedOnMouseDown && e.button == self.DRAG_NODE_MOUSE_BUTTON) {
            self.selection.push({x: e.clientX, y: e.clientY});
//			if (!self.leftScroll && (e.x <= window.innerWidth * self.PAN_ZONE_PART)) {
//				self.leftScroll = true;
//				self.panLeft();
//			} else if (!(e.x <= window.innerWidth * self.PAN_ZONE_PART)) {
//				self.leftScroll = false;
//				clearTimeout(self.leftScrollTimeout);
//			}
//			if (!self.rightScroll && (e.x >= (window.innerWidth * (1 - self.PAN_ZONE_PART)))) {
//				self.rightScroll = true;
//				self.panRight();
//			} else if (!(e.x >= (window.innerWidth * (1 - self.PAN_ZONE_PART)))) {
//				self.rightScroll = false;
//				clearTimeout(self.rightScrollTimeout);
//			}
//			if (!self.topScroll && (e.y <= (window.innerHeight * self.PAN_ZONE_PART))) {
//				self.topScroll = true;
//				self.panUp();
//			} else if (!(e.y <= (window.innerHeight * self.PAN_ZONE_PART))) {
//				self.topScroll = false;
//				clearTimeout(self.topScrollTimeout);
//			}
//			if (!self.bottomScroll && (e.y >= (window.innerHeight * (1 - self.PAN_ZONE_PART)))) {
//				self.bottomScroll = true;
//				self.panDown();
//			} else if (!(e.y >= (window.innerHeight * (1 - self.PAN_ZONE_PART)))) {
//				self.bottomScroll = false;
//				clearTimeout(self.bottomScrollTimeout);
//			}
		} else if (self.dragView) {
            self.setView(self.currentZoom, self.viewX - e.webkitMovementX * self.currentZoom, self.viewY - e.webkitMovementY * self.currentZoom);
        }
    };
    window.document.onmouseout = function () {
        self.leftScroll = false;
        clearTimeout(self.leftScrollTimeout);
        self.rightScroll = false;
        clearTimeout(self.rightScrollTimeout);
        self.topScroll = false;
        clearTimeout(self.topScrollTimeout);
        self.bottomScroll = false;
        clearTimeout(self.bottomScrollTimeout);
    };
    // keyboard
    window.onkeydown = function (e) {
        var result = true;
        switch (e.keyCode) {
            // backspace
            case 8:
                for (var nodeId in self.selectedNodes) {
                    var nodeText = self.selectedNodes[nodeId].text.attr("text");
                    self.selectedNodes[nodeId].text.attr({text: nodeText.substring(0, nodeText.length - 1)});
                    self.serializableNodes[nodeId].text = nodeText.substring(0, nodeText.length - 1);
                }
                for (var relId in self.selectedRelationships) {
                    var relText = self.selectedRelationships[relId].text.attr("text");
                    self.selectedRelationships[relId].text.attr({text: relText.substring(0, relText.length - 1)});
                    self.serializableRelationships[relId].text = relText.substring(0, relText.length - 1);
                }
                if (!isEmpty(self.selectedNodes) || !isEmpty(self.selectedRelationships)) {
                    result = false;
                }
                break;
            // enter
            case 13:
                for (var nodeId in self.selectedNodes) {
                    var nodeText = self.selectedNodes[nodeId].text.attr("text");
                    self.selectedNodes[nodeId].text.attr({text: nodeText + "\n"});
                    self.serializableNodes[nodeId].text = nodeText + "\n";
                }
                for (var relId in self.selectedRelationships) {
                    var relText = self.selectedRelationships[relId].text.attr("text");
                    self.selectedRelationships[relId].text.attr({text: relText + "\n"});
                    self.serializableRelationships[relId].text = relText + "\n";
                }
                break;
            // escape
            case 27:
                    self.clearSelection();
                break;
            // left arrow
            case 37:
                self.setView(self.currentZoom, self.viewX - self.PAN_KEYBOARD_STEP, self.viewY);
                break;
            // up arrow
            case 38:
                self.setView(self.currentZoom, self.viewX, self.viewY - self.PAN_KEYBOARD_STEP);
                break;
            // right arrow
            case 39:
                self.setView(self.currentZoom, self.viewX + self.PAN_KEYBOARD_STEP, self.viewY);
                break;
            // down arrow
            case 40:
                self.setView(self.currentZoom, self.viewX, self.viewY + self.PAN_KEYBOARD_STEP);
                break;
            // delete
            case 46:
                for (var nodeId in self.selectedNodes) {
                    self.selectedNodes[nodeId].text.attr({text: ""});
                    self.serializableNodes[nodeId].text = "";
                }
                for (var relId in self.selectedRelationships) {
                    self.selectedRelationships[relId].text.attr({text: ""});
                    self.serializableRelationships[relId].text = "";
                }
                break;
        }
        for (var nodeId in self.selectedNodes) {
            self.updateNodeSize(self.selectedNodes[nodeId]);
        }
        return result;
    };
    window.onkeypress = function (e) {
        if (!isEmpty(self.selectedNodes) || !isEmpty(self.selectedRelationships)) {
            for (var nodeId in self.selectedNodes) {
                var nodeText = self.selectedNodes[nodeId].text.attr("text") + String.fromCharCode(e.keyCode);
                self.selectedNodes[nodeId].text.attr({text: nodeText});
                self.serializableNodes[nodeId].text = nodeText;
            }
            for (var relId in self.selectedRelationships) {
                var relText = self.selectedRelationships[relId].text.attr("text") + String.fromCharCode(e.keyCode);
                self.selectedRelationships[relId].text.attr({text: relText});
                self.serializableRelationships[relId].text = relText;
            }
        } else {
            switch (e.keyCode) {
                // e
                case 101:
                    var mem = document.getElementById("memo").firstChild;
                    var uriContent = "data:image/svg+xml;filename=filename.svg," + encodeURIComponent((new XMLSerializer()).serializeToString(mem));
                    var downloadLink = document.createElement("a");
                    downloadLink.href = uriContent;
                    downloadLink.download = "mem.svg";
                    downloadLink.click();
                    break;
                // s
                case 115:
                    var mem = JSON.stringify({
                        lastNodeId: self.lastNodeId,
                        lastConnectionId: self.lastConnectionId,
                        serializableNodes: self.serializableNodes,
                        serializableRelationships: self.serializableRelationships
                    });
                    var uriContent = "data:application/json;filename=filename.json," + mem;
                    var downloadLink = document.createElement("a");
                    downloadLink.href = uriContent;
                    downloadLink.download = "mem.json";
                    downloadLink.click();
                    break;
                // o
                case 111:
                    var loadMem = function(e) {
                        var files = e.target.files;
                        var file = files[0];
                        var reader = new FileReader();
                        reader.onload = function(e) {
                            var mem = JSON.parse(e.target.result);
                            self.loadMem(mem);
                        };
                        reader.readAsText(file);
                    };
                    var textInput = document.createElement("input");
                    textInput.type = "file";
                    textInput.accept = ".json";
                    textInput.onchange = loadMem;
                    textInput.click();
                    break;
                // plus
                case 43:
                    self.setView(self.currentZoom / self.ZOOM_KEYBOARD_FACTOR, self.viewX + self.viewWidth / 2, self.viewY + self.viewHeight / 2);
                    break;
                // minus
                case 45:
                    self.setView(self.currentZoom * self.ZOOM_KEYBOARD_FACTOR, self.viewX + self.viewWidth / 2, self.viewY + self.viewHeight / 2);
                    break;
            }
            ;
        }
    };
}

Memo.prototype.nextNodeId = function () {
    return this.lastNodeId++;
};

Memo.prototype.nextConnectionId = function () {
    return this.lastConnectionId++;
};

Memo.prototype.addNode = function (x, y, id, text) {
    var width = this.NODE_MIN_WIDTH;
    var height = this.NODE_MIN_HEIGHT;
    var nodeId = id;
    if (!nodeId) {
        nodeId = this.nextNodeId();
    }
    var node = this.paper.rect(x - width / 2, y - height / 2, width, height, 10);
    node.data("id", nodeId);
    this.nodes[nodeId] = node;
    this.serializableNodes[nodeId] = {id: nodeId, x: x, y: y, text: text};
    node.data("id", nodeId);
    node.attr({fill: this.NODE_STROKE_COLOR, stroke: this.NODE_STROKE_COLOR, "fill-opacity": 0, "stroke-width": 4, cursor: "move"});
    // drag functions
    var self = this;
    var moveNode = function (dx, dy, x, y, mouseEvent) {
        if (mouseEvent.button === self.DRAG_NODE_MOUSE_BUTTON) {
            if (isEmpty(self.selectedNodes)) {
                self.moveNode(this, dx, dy);
            } else if (this.data("id") in self.selectedNodes) {
                for (var nodeId in self.selectedNodes) {
                    self.moveNode(self.selectedNodes[nodeId], dx, dy);
                }
            }
        }
        if (dx || dy) {
            self.setLastGrippedNode(this);
        }
        self.minX = Math.min(self.minX, this.attr("x"));
        self.minY = Math.min(self.minY, this.attr("y"));
        self.maxX = Math.max(self.maxX, this.attr("x") + this.attr("width"));
        self.maxY = Math.max(self.maxY, this.attr("y") + this.attr("height"));
    };
    var gripNode = function (x, y, mouseEvent) {
        if (mouseEvent.button === self.DRAG_NODE_MOUSE_BUTTON) {
            var grippedNodes = {};
            if (isEmpty(self.selectedNodes)) {
                grippedNodes[this.data("id")] = this;
            } else if (self.selectedNodes[this.data("id")] !== undefined) {
                grippedNodes = self.selectedNodes;
            }
            self.gripNodes(grippedNodes);
        }
        self.clearLastGrippedNode();
    };
    var releaseNode = function (mouseEvent) {
        if (mouseEvent.button === self.DRAG_NODE_MOUSE_BUTTON) {
            var grippedNodes = {};
            if (isEmpty(self.selectedNodes)) {
                grippedNodes[this.data("id")] = this;
            } else {
                grippedNodes = self.selectedNodes;
            }
            self.releaseNodes(grippedNodes);
        }
    };
    node.drag(moveNode, gripNode, releaseNode);
    this.adjacencyMatrix[nodeId] = {};
    var nodeText = text;
    if (!nodeText) {
        nodeText = "";
    }
    node.text = this.paper.text(x, y, nodeText);
    this.updateNodeSize(node);
    node.text.data("nodeId", nodeId);
    node.text.attr({stroke: this.NODE_STROKE_COLOR, fill: this.NODE_STROKE_COLOR, cursor: "move"});
    node.text.drag(moveNode, gripNode, releaseNode, node, node, node);
    node.text.click(function () {
        self.addSelectedNode(node);
    });
    this.addSelectedNode(node);
    this.minX = Math.min(this.minX, node.attr("x"));
    this.minY = Math.min(this.minY, node.attr("y"));
    this.maxX = Math.max(this.maxX, node.attr("x") + node.attr("width"));
    this.maxY = Math.max(this.maxY, node.attr("y") + node.attr("height"));
    return this.nodes[nodeId];
};

Memo.prototype.removeNode = function (node) {
    var removedNodeId = null;
    search:
        for (var nodeId in this.nodes) {
            if (this.nodes[nodeId] === node) {
                removedNodeId = nodeId;
                break search;
            }
        }
    var removedNode = null;
    if (removedNodeId) {
        removedNode = this.nodes[removedNodeId];
        delete this.selectedNodes[removedNodeId];
        for (var fromNodeId in this.adjacencyMatrix) {
            for (var toNodeId in this.adjacencyMatrix[fromNodeId]) {
                if ((fromNodeId == removedNodeId) || (toNodeId == removedNodeId)) {
                    this.removeConnectionById(this.adjacencyMatrix[fromNodeId][toNodeId]);
                }
            }
        }
        delete this.nodes[removedNodeId];
        delete this.serializableNodes[removedNodeId];
        delete this.adjacencyMatrix[nodeId];
        node.text.remove();
        node.remove();
    }
    return removedNode;
};

Memo.prototype.clearNodes = function () {
    for (var nodeId in this.nodes) {
        this.removeNode(this.nodes[nodeId]);
    }
};

Memo.prototype.gripNodes = function(nodes) {
    for (var nodeId in nodes) {
        var node = nodes[nodeId];
        node.gripX = node.attr("x");
        node.gripY = node.attr("y");
        node.animate({"fill-opacity": .2}, 100);
    }
}

Memo.prototype.releaseNodes = function(nodes) {
    for (var nodeId in nodes) {
        nodes[nodeId].animate({"fill-opacity": 0}, 100);
    }
}

Memo.prototype.moveNode = function(node, dx, dy) {
    var attr = {x: node.gripX + this.currentZoom * dx, y: node.gripY + this.currentZoom * dy};
    node.attr(attr);
    this.serializableNodes[node.data("id")].x = attr.x;
    this.serializableNodes[node.data("id")].y = attr.y;
    var textAttr = {x: node.gripX + node.attr("width") / 2 + this.currentZoom * dx, y: node.gripY + node.attr("height") / 2 + this.currentZoom * dy};
    node.text.attr(textAttr);
    for (var connectionId in this.relationships) {
        this.redrawConnection(this.relationships[connectionId]);
    }
}

Memo.prototype.addSelectedNode = function (node) {
    this.selectedNodes[node.data("id")] = node;
    node.attr({stroke: this.NODE_FOCUSED_STROKE_COLOR});
    node.text.attr({stroke: this.NODE_FOCUSED_STROKE_COLOR, "fill": this.NODE_FOCUSED_STROKE_COLOR});
};

Memo.prototype.addSelectedRelationship = function (rel) {
    this.selectedRelationships[rel.path.data("id")] = rel;
    rel.path.attr({stroke: this.NODE_FOCUSED_STROKE_COLOR});
    rel.endCircle.attr({stroke: this.NODE_FOCUSED_STROKE_COLOR, "fill": this.NODE_FOCUSED_STROKE_COLOR});
    rel.text.attr({stroke: this.NODE_FOCUSED_STROKE_COLOR, "fill": this.NODE_FOCUSED_STROKE_COLOR});
};

Memo.prototype.removeSelectedNode = function (node) {
    delete this.selectedNodes[node.data("id")];
    node.attr({stroke: this.NODE_STROKE_COLOR});
    node.text.attr({stroke: this.NODE_STROKE_COLOR, "fill": this.NODE_STROKE_COLOR});
};

Memo.prototype.clearSelection = function () {
    for (var nodeId in this.selectedNodes) {
        this.selectedNodes[nodeId].attr({stroke: this.NODE_STROKE_COLOR});
        this.selectedNodes[nodeId].text.attr({stroke: this.NODE_STROKE_COLOR, "fill": this.NODE_STROKE_COLOR});
    }
    this.selectedNodes = {};
    for (var relId in this.selectedRelationships) {
        this.selectedRelationships[relId].path.attr({stroke: this.CONNECTION_STROKE_COLOR});
        this.selectedRelationships[relId].endCircle.attr({stroke: this.CONNECTION_STROKE_COLOR, fill: this.CONNECTION_STROKE_COLOR});
        this.selectedRelationships[relId].text.attr({stroke: this.CONNECTION_STROKE_COLOR, "fill": this.CONNECTION_STROKE_COLOR});
    }
    this.selectedRelationships = {};
};

Memo.prototype.updateNodeSize = function (node) {
    var textBBox = node.text.getBBox();
    var width = node.attr("width") > textBBox.width ? node.attr("width") : textBBox.width;
    var dx = node.attr("width") > textBBox.width ? 0 : (textBBox.width - node.attr("width")) / 2;
    var height = node.attr("height") > textBBox.height ? node.attr("height") : textBBox.height;
    var dy = node.attr("height") > textBBox.height ? 0 : (textBBox.height - node.attr("height")) / 2;
    node.attr({x: node.attr("x") - dx, y: node.attr("y") - dy, width: width, height: height});
    for (var connectionId in this.relationships) {
        this.redrawConnection(this.relationships[connectionId]);
    }
};

Memo.prototype.setLastGrippedNode = function (node) {
    this.lastGrippedNode = node;
};

Memo.prototype.getLastGrippedNode = function () {
    return this.lastGrippedNode;
};

Memo.prototype.clearLastGrippedNode = function () {
    this.lastGrippedNode = null;
};

Memo.prototype.getConnectionPath = function (fromNode, toNode) {
    var fromX = fromNode.attr("x") + fromNode.attr("width") / 2;
    var fromY = fromNode.attr("y") + fromNode.attr("height") / 2;
    var toX = toNode.attr("x") + toNode.attr("width") / 2;
    var toY = toNode.attr("y") + toNode.attr("height") / 2;
    var dx = toX - fromX;
    var dy = toY - fromY;
    var startX = 0;
    var startY = 0;
    var x1 = 0;
    var y1 = 0;
    var x2 = 0;
    var y2 = 0;
    var endX = 0;
    var endY = 0;
    if (Math.abs(dx) > Math.abs(dy)) {
        // from left to right
        if (dx >= 0) {
            startX = fromNode.attr("x") + fromNode.attr("width");
            startY = fromNode.attr("y") + fromNode.attr("height") / 2;
            x1 = startX + dx / 5;
            y1 = startY;
            endX = toNode.attr("x");
            endY = toNode.attr("y") + toNode.attr("height") / 2;
            x2 = endX - dx / 5;
            y2 = endY;
            // from right to left
        } else {
            startX = fromNode.attr("x");
            startY = fromNode.attr("y") + fromNode.attr("height") / 2;
            x1 = startX + dx / 5;
            y1 = startY;
            endX = toNode.attr("x") + toNode.attr("width");
            endY = toNode.attr("y") + toNode.attr("height") / 2;
            x2 = endX - dx / 5;
            y2 = endY;
        }
    } else {
        // from top to bottom
        if (dy >= 0) {
            startX = fromNode.attr("x") + fromNode.attr("width") / 2;
            startY = fromNode.attr("y") + fromNode.attr("height");
            x1 = startX;
            y1 = startY + dy / 5;
            endX = toNode.attr("x") + toNode.attr("width") / 2;
            endY = toNode.attr("y");
            x2 = endX;
            y2 = endY - dy / 5;
            // from bottom to top
        } else {
            startX = fromNode.attr("x") + fromNode.attr("width") / 2;
            startY = fromNode.attr("y");
            x1 = startX;
            y1 = startY + dy / 5;
            endX = toNode.attr("x") + toNode.attr("width") / 2;
            endY = toNode.attr("y") + toNode.attr("height");
            x2 = endX;
            y2 = endY - dy / 5;
        }
    }
    return {
        path: ["M", startX.toFixed(3), startY.toFixed(3), "C", x1, y1, x2, y2, endX.toFixed(3), endY.toFixed(3)].join(","),
        endX: endX,
        endY: endY
    };
};

Memo.prototype.drawConnection = function (connectionId, fromNode, toNode, text) {
    var self = this;
    var connectionPath = this.getConnectionPath(fromNode, toNode);
    var pathElement = this.paper.path(connectionPath.path);
    pathElement.data("id", connectionId);
    pathElement.data("fromNodeId", fromNode.data("id"));
    pathElement.data("toNodeId", toNode.data("id"));
    pathElement.attr({"stroke": this.CONNECTION_STROKE_COLOR, "stroke-width": this.CONNECTION_WIDTH});
    var endCircle = this.paper.circle(connectionPath.endX, connectionPath.endY, 5);
    endCircle.attr({"stroke": this.CONNECTION_STROKE_COLOR, "fill": this.CONNECTION_STROKE_COLOR});
    var textElementPosition = Raphael.getPointAtLength(connectionPath.path, Raphael.getTotalLength(connectionPath.path)/2);
    if (!text) {
        text = "";
    }
    var textElement = this.paper.text(textElementPosition.x, textElementPosition.y, text);
    textElement.attr({"stroke": this.CONNECTION_STROKE_COLOR, "fill": this.CONNECTION_STROKE_COLOR, "cursor": "default"});
    textElement.click(function () {
        self.selectedRelationships[connectionId] = self.relationships[connectionId];
    });
    return {
        path: pathElement,
        endCircle: endCircle,
        text: textElement
    };
};

Memo.prototype.redrawConnection = function (connection) {
    var fromNode = this.nodes[connection.path.data("fromNodeId")];
    var toNode = this.nodes[connection.path.data("toNodeId")];
    var connectionPath = this.getConnectionPath(fromNode, toNode);
    connection.path.attr({"path": connectionPath.path});
    connection.endCircle.attr({"cx": connectionPath.endX, "cy": connectionPath.endY});
    var textElementPosition = Raphael.getPointAtLength(connectionPath.path, Raphael.getTotalLength(connectionPath.path)/2);
    connection.text.attr({"x": textElementPosition.x, "y": textElementPosition.y});
};

Memo.prototype.addConnection = function (fromNodeId, toNodeId, id, text) {
    var self = this;
    var connectionId = id;
    if (!connectionId) {
        connectionId = this.nextConnectionId();
    }
    var fromNode = this.nodes[fromNodeId];
    var toNode = this.nodes[toNodeId];
    this.relationships[connectionId] = this.drawConnection(connectionId, fromNode, toNode, text);
    this.relationships[connectionId].path.click(function() {
        self.selectedRelationships[connectionId] = self.relationships[connectionId];
    });
    this.serializableRelationships[connectionId] = {fromNodeId: fromNodeId, toNodeId: toNodeId, id: connectionId};
    this.adjacencyMatrix[fromNodeId][toNodeId] = connectionId;
};

Memo.prototype.removeConnectionById = function (connectionId) {
    var removedConnection = this.relationships[connectionId];
    delete this.relationships[connectionId];
    delete this.selectedRelationships[connectionId];
    delete this.serializableRelationships[connectionId];
    delete this.adjacencyMatrix[removedConnection.path.data("fromNodeId")][removedConnection.path.data("toNodeId")];
    removedConnection.path.remove();
    removedConnection.endCircle.remove();
	removedConnection.text.remove();
    return removedConnection;
};

Memo.prototype.removeConnection = function (connection) {
    this.removeConnectionById(connection.data("id"));
};

Memo.prototype.clearConnections = function () {
    for (var connectionId in this.relationships) {
        this.removeConnectionById(connectionId);
    }
};

Memo.prototype.setConnectionBeginElement = function (element) {
    this.connectionBeginElement = element;
};

Memo.prototype.getConnectionBeginElement = function () {
    return this.connectionBeginElement;
};

Memo.prototype.setView = function (zoom, viewX, viewY) {
    this.currentZoom = zoom;
    this.viewWidth = this.currentZoom * this.baseViewWidth;
    this.viewHeight = this.currentZoom * this.baseViewHeight;
    if ((this.maxX - this.minX) <= this.viewWidth) {
        if (viewX < this.maxX - this.viewWidth / 2 + this.MARGIN * this.currentZoom) {
            this.viewX = this.maxX - this.viewWidth / 2 + this.MARGIN * this.currentZoom;
        } else if (viewX > this.minX + this.viewWidth / 2 - this.MARGIN * this.currentZoom) {
            this.viewX = this.minX + this.viewWidth / 2 - this.MARGIN * this.currentZoom;
        } else {
            this.viewX = viewX;
        }
    } else {
        if (viewX > this.maxX - this.viewWidth / 2 + this.MARGIN * this.currentZoom) {
            this.viewX = this.maxX - this.viewWidth / 2 + this.MARGIN * this.currentZoom;
        } else if (viewX < this.minX + this.viewWidth / 2 - this.MARGIN * this.currentZoom) {
            this.viewX = this.minX + this.viewWidth / 2 - this.MARGIN * this.currentZoom;
        } else {
            this.viewX = viewX;
        }
    }
    if ((this.maxY - this.minY) <= this.viewHeight) {
        if (viewY < this.maxY - this.viewHeight / 2 + this.MARGIN * this.currentZoom) {
            this.viewY = this.maxY - this.viewHeight / 2 + this.MARGIN * this.currentZoom;
        } else if (viewY > this.minY + this.viewHeight / 2 - this.MARGIN * this.currentZoom) {
            this.viewY = this.minY + this.viewHeight / 2 - this.MARGIN * this.currentZoom;
        } else {
            this.viewY = viewY;
        }
    } else {
        if (viewY > this.maxY - this.viewHeight / 2 + this.MARGIN * this.currentZoom) {
            this.viewY = this.maxY - this.viewHeight / 2 + this.MARGIN * this.currentZoom;
        } else if (viewY < this.minY + this.viewHeight / 2 - this.MARGIN * this.currentZoom) {
            this.viewY = this.minY + this.viewHeight / 2 - this.MARGIN * this.currentZoom;
        } else {
            this.viewY = viewY;
        }
    }
    this.paper.setViewBox(viewX - this.viewWidth / 2, viewY - this.viewHeight / 2, this.viewWidth, this.viewHeight);
};

Memo.prototype.animateZoom = function (viewX, viewY) {
    var self = this;
    for (var i in this.zoomTimeouts) {
        clearTimeout(this.zoomTimeouts[i]);
    }
    this.zoomTimeouts = [];
    var numberOfFrames = this.FRAME_RATE * this.ZOOM_TIME / 1000;
    var zoomStep = (this.currentZoom - this.requestedMouseZoom) / numberOfFrames;
    var panXStep = (this.viewX - viewX) / numberOfFrames;
    var panYStep = (this.viewY - viewY) / numberOfFrames;
    var zoomTimeStep = this.ZOOM_TIME / numberOfFrames;
    for (var i = 0; i < numberOfFrames; i++) {
        (function (i) {
            self.zoomTimeouts.push(setTimeout(function () {
                self.setView(self.currentZoom - zoomStep, self.viewX + panXStep, self.viewY + panYStep)
            }, (i + 1) * zoomTimeStep));
        })(i);
    }
};

Memo.prototype.panLeft = function () {
    var panStep = this.currentZoom * this.PAN_SPEED / this.FRAME_RATE;
    this.setView(this.currentZoom, this.viewX - panStep, this.viewY);
    var self = this;
    this.leftScrollTimeout = setTimeout(function () {
        self.panLeft();
    }, 1000 / this.FRAME_RATE);
};

Memo.prototype.panRight = function () {
    var panStep = this.currentZoom * this.PAN_SPEED / this.FRAME_RATE;
    this.setView(this.currentZoom, this.viewX + panStep, this.viewY);
    var self = this;
    this.rightScrollTimeout = setTimeout(function () {
        self.panRight();
    }, 1000 / this.FRAME_RATE);
};

Memo.prototype.panUp = function () {
    var panStep = this.currentZoom * this.PAN_SPEED / this.FRAME_RATE;
    this.setView(this.currentZoom, this.viewX, this.viewY - panStep);
    var self = this;
    this.topScrollTimeout = setTimeout(function () {
        self.panUp();
    }, 1000 / this.FRAME_RATE);
};

Memo.prototype.panDown = function () {
    var panStep = this.currentZoom * this.PAN_SPEED / this.FRAME_RATE;
    this.setView(this.currentZoom, this.viewX, this.viewY + panStep);
    var self = this;
    this.bottomScrollTimeout = setTimeout(function () {
        self.panDown();
    }, 1000 / this.FRAME_RATE);
};

Memo.prototype.fillDocument = function () {
    this.width = window.innerWidth - 1;
    this.height = window.innerHeight - 1;
    this.viewWidth = this.width;
    this.viewHeight = this.height;
    this.paper.setSize(this.width, this.height);
};

Memo.prototype.loadMem = function(mem) {
    this.clearSelection();
    this.clearLastGrippedNode();
    this.clearNodes();
    this.clearConnections();
    this.adjacencyMatrix = {};
    this.lastNodeId = mem.lastNodeId;
    this.lastConnectionId = mem.lastConnectionId;
    for (var nodeId in mem.serializableNodes) {
        var node = mem.serializableNodes[nodeId];
        this.addNode(node.x, node.y, node.id, node.text);
    }
    for (var connectionId in mem.serializableRelationships) {
        var connection = mem.serializableRelationships[connectionId];
        this.addConnection(connection.fromNodeId, connection.toNodeId, connection.id, connection.text);
    }
    this.clearSelection();
};

var memo;

window.onload = function () {
    memo = new Memo();
};

function isEmpty(map) {
    for(var key in map) {
        if (map.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}
