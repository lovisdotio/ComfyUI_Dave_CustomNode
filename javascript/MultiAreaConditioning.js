console.log("[MultiAreaConditioning DEBUG] MultiAreaConditioning.js loaded");
import { app } from "/scripts/app.js";
import {CUSTOM_INT, recursiveLinkUpstream, transformFunc, swapInputs, renameNodeInputs, removeNodeInputs, getDrawColor, computeCanvasSize} from "./utils.js"

function addMultiAreaConditioningCanvas(node, app) {
	console.log("[MultiAreaConditioning DEBUG] addMultiAreaConditioningCanvas called for node:", node.id);

	const widget = {
		type: "customCanvas",
		name: "MultiAreaConditioning-Canvas",
		get value() {
			return this.canvas.value;
		},
		set value(x) {
			this.canvas.value = x;
		},
		draw: function (ctx, node, slotWidth, slotY) {
			console.log("[MultiAreaConditioning DEBUG] widget.draw called for node:", node.id, "slotWidth:", slotWidth, "slotY:", slotY);
			
			if (!node.canvasHeight) {
				console.log("[MultiAreaConditioning DEBUG] node.canvasHeight not set, calling computeCanvasSize.");
				computeCanvasSize(node, node.size);
			}
			console.log("[MultiAreaConditioning DEBUG] node.canvasHeight:", node.canvasHeight, "node.size:", node.size);

			const visible = true;
			const t = ctx.getTransform();
			const margin = 10;
			const border = 2;

			const allocatedSlotHeight = node.canvasHeight;
            const values = node.properties["values"];
			const contentBaseWidth = Math.round(node.properties["width"]);
			const contentBaseHeight = Math.round(node.properties["height"]);

			console.log("[MultiAreaConditioning DEBUG] Drawing params: contentBaseWidth:", contentBaseWidth, "contentBaseHeight:", contentBaseHeight, "allocatedSlotHeight:", allocatedSlotHeight);

			const scale = Math.min((slotWidth - margin*2) / contentBaseWidth, (allocatedSlotHeight - margin*2) / contentBaseHeight);
			console.log("[MultiAreaConditioning DEBUG] Calculated scale:", scale);

			const scaledContentWidth = contentBaseWidth * scale;
			const scaledContentHeight = contentBaseHeight * scale;

			let centeringOffsetX = margin;
			if (scaledContentWidth < slotWidth - margin*2) {
				centeringOffsetX = (slotWidth - scaledContentWidth) / 2;
			} else {
			    centeringOffsetX = margin;
            }

			let centeringOffsetY = margin;
			if (scaledContentHeight < allocatedSlotHeight - margin*2) {
				centeringOffsetY = (allocatedSlotHeight - scaledContentHeight) / 2;
			} else {
                centeringOffsetY = margin;
            }

			const index = Math.round(node.widgets[node.index].value);

			Object.assign(this.canvas.style, {
				left: `${t.e}px`,
				top: `${t.f + (slotY * t.d)}px`,
				width: `${slotWidth * t.a}px`,
				height: `${allocatedSlotHeight * t.d}px`,
				position: "absolute",
				zIndex: 1000,
				fontSize: `${t.d * 10.0}px`,
			});
			console.log("[MultiAreaConditioning DEBUG] HTML Overlay Canvas style applied. ScreenTop for widget:", t.f + (slotY * t.d));

			this.canvas.hidden = !visible;
			console.log("[MultiAreaConditioning DEBUG] HTML Overlay Canvas hidden:", this.canvas.hidden);

            const nodeInternalXPadding = 0;
            const drawBaseX = nodeInternalXPadding + centeringOffsetX;
            const drawBaseY = centeringOffsetY;

			ctx.fillStyle = "#000000";
			ctx.fillRect(slotX + drawBaseX - border, slotY + drawBaseY - border, scaledContentWidth + border*2, scaledContentHeight + border*2);

			ctx.fillStyle = globalThis.LiteGraph.NODE_DEFAULT_BGCOLOR;
			ctx.fillRect(slotX + drawBaseX, slotY + drawBaseY, scaledContentWidth, scaledContentHeight);

			function getDrawArea(v) {
				let x_rel = v[0] * scaledContentWidth / contentBaseWidth;
				let y_rel = v[1] * scaledContentHeight / contentBaseHeight;
				let w_scaled = v[2] * scaledContentWidth / contentBaseWidth;
				let h_scaled = v[3] * scaledContentHeight / contentBaseHeight;

				if (x_rel > scaledContentWidth) { x_rel = scaledContentWidth; }
				if (y_rel > scaledContentHeight) { y_rel = scaledContentHeight; }

				if (x_rel + w_scaled > scaledContentWidth) {
					w_scaled = Math.max(0, scaledContentWidth - x_rel);
				}
				
				if (y_rel + h_scaled > scaledContentHeight) {
					h_scaled = Math.max(0, scaledContentHeight - y_rel);
				}
				return [x_rel, y_rel, w_scaled, h_scaled];
			}
            
			for (const [k, v] of values.entries()) {
				if (k == index) { continue; }
				const [x_r, y_r, w_s, h_s] = getDrawArea(v);
				ctx.fillStyle = getDrawColor(k/values.length, "80");
				ctx.fillRect(slotX + drawBaseX + x_r, slotY + drawBaseY + y_r, w_s, h_s);
			}

			ctx.beginPath();
			ctx.lineWidth = 1;

			const gridSpacingScaled = 64 * scale;
			for (let gx = 0; gx <= contentBaseWidth / 64; gx += 1) {
				ctx.moveTo(slotX + drawBaseX + gx * gridSpacingScaled, slotY + drawBaseY);
				ctx.lineTo(slotX + drawBaseX + gx * gridSpacingScaled, slotY + drawBaseY + scaledContentHeight);
			}
			for (let gy = 0; gy <= contentBaseHeight / 64; gy += 1) {
				ctx.moveTo(slotX + drawBaseX, slotY + drawBaseY + gy * gridSpacingScaled);
				ctx.lineTo(slotX + drawBaseX + scaledContentWidth, slotY + drawBaseY + gy * gridSpacingScaled);
			}

			ctx.strokeStyle = "#00000050";
			ctx.stroke();
			ctx.closePath();

			let [sel_x_r, sel_y_r, sel_w_s, sel_h_s] = getDrawArea(values[index]);
			sel_w_s = Math.max(32*scale, sel_w_s);
			sel_h_s = Math.max(32*scale, sel_h_s);

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(slotX + drawBaseX + sel_x_r, slotY + drawBaseY + sel_y_r, sel_w_s, sel_h_s);

			const selectedColor = getDrawColor(index/values.length, "FF");
			ctx.fillStyle = selectedColor;
			ctx.fillRect(slotX + drawBaseX + sel_x_r + border, slotY + drawBaseY + sel_y_r + border, sel_w_s - border*2, sel_h_s - border*2);

			ctx.beginPath();
			ctx.arc(LiteGraph.NODE_SLOT_HEIGHT*0.5, LiteGraph.NODE_SLOT_HEIGHT*(index + 0.5)+4, 4, 0, Math.PI * 2);
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = "white";
			ctx.stroke();

			if (node.selected) {
				const connectedNodes = recursiveLinkUpstream(node, node.inputs[index].type, 0, index)
				
				if (connectedNodes.length !== 0) {
					for (let [node_ID, depth] of connectedNodes) {
						let connectedNode = node.graph._nodes_by_id[node_ID]
						if (connectedNode.type != node.type) {
							const [x, y] = connectedNode.pos
							const [w, h] = connectedNode.size
							const offset = 5
							const titleHeight = LiteGraph.NODE_TITLE_HEIGHT * (connectedNode.type === "Reroute"  ? 0 : 1)

							ctx.strokeStyle = selectedColor
							ctx.lineWidth = 5;
							ctx.strokeRect(x-offset-node.pos[0], y-offset-node.pos[1]-titleHeight, w+offset*2, h+offset*2+titleHeight)
						}
					}
				}
			}
			ctx.lineWidth = 1;
			ctx.closePath();

		},
	};

	widget.canvas = document.createElement("canvas");
	widget.canvas.className = "dave-custom-canvas";

	widget.parent = node;
	document.body.appendChild(widget.canvas);

	node.addCustomWidget(widget);

	app.canvas.onDrawBackground = function () {
		for (let n in app.graph._nodes) {
			n = graph._nodes[n];
			for (let w in n.widgets) {
				let wid = n.widgets[w];
				if (Object.hasOwn(wid, "canvas")) {
					wid.canvas.style.left = -8000 + "px";
					wid.canvas.style.position = "absolute";
				}
			}
		}
	};

	node.onResize = function (size) {
		computeCanvasSize(node, size);
	}

	return { minWidth: 200, minHeight: 200, widget }
}

app.registerExtension({
	name: "Comfy.Davemane42.MultiAreaConditioning",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "MultiAreaConditioning") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				console.log("[MultiAreaConditioning DEBUG] onNodeCreated called for node:", this.id);
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

				this.setProperty("width", 512)
				this.setProperty("height", 512)
				this.setProperty("values", [[0, 0, 0, 0, 1.0], [0, 0, 0, 0, 1.0]])

				this.selected = false
				this.index = 3

                this.serialize_widgets = true;

				CUSTOM_INT(this, "resolutionX", 512, function (v, _, node) {const s = this.options.step / 10; this.value = Math.round(v / s) * s; node.properties["width"] = this.value})
				CUSTOM_INT(this, "resolutionY", 512, function (v, _, node) {const s = this.options.step / 10; this.value = Math.round(v / s) * s; node.properties["height"] = this.value})
                
				addMultiAreaConditioningCanvas(this, app)

				CUSTOM_INT(
					this,
					"index",
					0,
					function (v, _, node) {

						let values = node.properties["values"]

						node.widgets[4].value = values[v][0]
						node.widgets[5].value = values[v][1]
						node.widgets[6].value = values[v][2]
						node.widgets[7].value = values[v][3]
						if (!values[v][4]) {values[v][4] = 1.0}
						node.widgets[8].value = values[v][4]
					},
					{ step: 10, max: 1 }

				)
				
				CUSTOM_INT(this, "x", 0, function (v, _, node) {transformFunc(this, v, node, 0)})
				CUSTOM_INT(this, "y", 0, function (v, _, node) {transformFunc(this, v, node, 1)})
				CUSTOM_INT(this, "width", 0, function (v, _, node) {transformFunc(this, v, node, 2)})
				CUSTOM_INT(this, "height", 0, function (v, _, node) {transformFunc(this, v, node, 3)})
				CUSTOM_INT(this, "strength", 1, function (v, _, node) {transformFunc(this, v, node, 4)}, {"min": 0.0, "max": 10.0, "step": 0.1, "precision": 2})

				this.getExtraMenuOptions = function(_, options) {
					options.unshift(
						{
							content: `insert input above ${this.widgets[this.index].value} /\\`,
							callback: () => {
								this.addInput("conditioning", "CONDITIONING")
								
								const inputLenth = this.inputs.length-1
								const index = this.widgets[this.index].value

								for (let i = inputLenth; i > index; i--) {
									swapInputs(this, i, i-1)
								}
								renameNodeInputs(this, "conditioning")

								this.properties["values"].splice(index, 0, [0, 0, 0, 0, 1])
								this.widgets[this.index].options.max = inputLenth

								this.setDirtyCanvas(true);

							},
						},
						{
							content: `insert input below ${this.widgets[this.index].value} \\/`,
							callback: () => {
								this.addInput("conditioning", "CONDITIONING")
								
								const inputLenth = this.inputs.length-1
								const index = this.widgets[this.index].value

								for (let i = inputLenth; i > index+1; i--) {
									swapInputs(this, i, i-1)
								}
								renameNodeInputs(this, "conditioning")

								this.properties["values"].splice(index+1, 0, [0, 0, 0, 0, 1])
								this.widgets[this.index].options.max = inputLenth

								this.setDirtyCanvas(true);
							},
						},
						{
							content: `swap with input above ${this.widgets[this.index].value} /\\`,
							callback: () => {
								const index = this.widgets[this.index].value
								if (index !== 0) {
									swapInputs(this, index, index-1)

									renameNodeInputs(this, "conditioning")

									this.properties["values"].splice(index-1,0,this.properties["values"].splice(index,1)[0]);
									this.widgets[this.index].value = index-1

									this.setDirtyCanvas(true);
								}
							},
						},
						{
							content: `swap with input below ${this.widgets[this.index].value} \\/`,
							callback: () => {
								const index = this.widgets[this.index].value
								if (index !== this.inputs.length-1) {
									swapInputs(this, index, index+1)

									renameNodeInputs(this, "conditioning")
									
									this.properties["values"].splice(index+1,0,this.properties["values"].splice(index,1)[0]);
									this.widgets[this.index].value = index+1

									this.setDirtyCanvas(true);
								}
							},
						},
						{
							content: `remove currently selected input ${this.widgets[this.index].value}`,
							callback: () => {
								const index = this.widgets[this.index].value
								removeNodeInputs(this, [index])
								renameNodeInputs(this, "conditioning")
							},
						},
						{
							content: "remove all unconnected inputs",
							callback: () => {
								let indexesToRemove = []

								for (let i = 0; i < this.inputs.length; i++) {
									if (!this.inputs[i].link) {
										indexesToRemove.push(i)
									}
								}

								if (indexesToRemove.length) {
									removeNodeInputs(this, indexesToRemove, "conditioning")
								}
								renameNodeInputs(this, "conditioning")
							},
						},
					);
				}

				this.onRemoved = function () {
					for (let y in this.widgets) {
						if (this.widgets[y].canvas) {
							this.widgets[y].canvas.remove();
						}
					}
				};
			
				this.onSelected = function () {
					this.selected = true
				}
				this.onDeselected = function () {
					this.selected = false
				}

				return r;
			};
		}
	},
	loadedGraphNode(node, _) {
		if (node.type === "MultiAreaConditioning") {
			node.widgets[node.index].options["max"] = node.properties["values"].length-1
		}
	},
	
});