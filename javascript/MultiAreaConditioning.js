console.log("[MultiAreaConditioning DEBUG] MultiAreaConditioning.js loaded");
import { app } from "/scripts/app.js";
import {CUSTOM_INT, recursiveLinkUpstream, transformFunc, swapInputs, renameNodeInputs, removeNodeInputs, getDrawColor} from "./utils.js"

function addMultiAreaConditioningCanvas(node, app) {
	console.log("[MultiAreaConditioning DEBUG] addMultiAreaConditioningCanvas called for node:", node.id);

	const widget = {
		type: "customCanvas",
		name: "MultiAreaConditioning-Canvas",
		computeSize: function(out) {
			// LiteGraph might pass an array to fill, or nothing.
			// It might also sometimes pass the node's current width as the first argument to some widget computeSize signatures,
			// but the typical widget computeSize(out) expects out to be an array [width, height] or undefined.
			// We primarily want to set the height here and let LiteGraph manage width.
			
			var width = LiteGraph.NODE_WIDTH; // Default node width, or use passed node_width if available
			// Some widget computeSize signatures get (node_width) or (node_width, out_object)
			// Let's check if 'out' is actually the width first.
			if (typeof out === 'number') { // If LiteGraph passed node width as the first param
				width = out;
				out = arguments[1] || new Float32Array([width, 200]); // Check for a second 'out' param or create new
			} else { // Standard computeSize(out) signature
				out = out || new Float32Array([width, 200]);
			}

			// Ensure out is an array/Float32Array with at least 2 elements
			if (!out.length || out.length < 2) {
				out = new Float32Array([width, 200]);
			}
			
			// We don't want to dictate the width from here, let the node itself or LiteGraph do that.
			// We primarily care about specifying the height.
			out[0] = 0; // Request 0 width, meaning use node's width or what LiteGraph calculates for it.
			out[1] = 200; // Request 200px height for this custom canvas widget.

			// console.log(`[MAC DEBUG] computeSize for ${this.name} returning: [${out[0]}, ${out[1]}]`);
			return out;
		},
		draw: function (ctx, node, widgetWidth, widgetY, widgetHeight) {
			if (widgetWidth <= 0 || widgetHeight <= 0) {
				// console.warn(`[MAC Draw DEBUG] widget.draw: widgetWidth (${widgetWidth}) or widgetHeight (${widgetHeight}) is zero or negative. Skipping draw.`);
				return;
			}
			// console.log(`[MAC Draw DEBUG] Entry: WW: ${widgetWidth}, WH: ${widgetHeight}, NodeID: ${node.id}`);

			// Make margin adaptive to widgetHeight, ensure it's not too large for small heights
			let margin = 5;
			if (widgetHeight < 40) margin = 2; // Smaller margin if space is very tight
			if (widgetWidth < 40) margin = 2;

			const border = 2;

			const values = node.properties["values"];
			const previewWidth = Math.round(node.properties["width"]);
			const previewHeight = Math.round(node.properties["height"]);
			console.log(`[MAC Draw DEBUG] Preview Res: ${previewWidth}x${previewHeight}`);

			let indexToUse = 0;
			const widgetIdx = node.comfyWidgetIndexForAreaSelector;
			const areaSelectorWidget = node.widgets && node.widgets[widgetIdx];

			if (areaSelectorWidget && areaSelectorWidget.name === "index" && areaSelectorWidget.value !== null && typeof areaSelectorWidget.value !== 'undefined') {
				let numVal = Number(areaSelectorWidget.value);
				if (!isNaN(numVal)) { indexToUse = Math.round(numVal); }
			}

			let scale = 0.1;
			if (previewWidth > 0 && previewHeight > 0 && (widgetWidth - margin * 2) > 0 && (widgetHeight - margin * 2) > 0 ) {
				scale = Math.min((widgetWidth - margin * 2) / previewWidth, (widgetHeight - margin * 2) / previewHeight);
			} else {
				console.warn("[MAC Draw DEBUG] Zero dimension for scale calc. PW,PH,WW,WH, Margin:",previewWidth, previewHeight, widgetWidth, widgetHeight, margin );
			}
			 if (scale <= 0) {
				console.warn(`[MAC Draw DEBUG] Scale <=0, clamped to 0.01. PW,PH,WW,WH:`,previewWidth, previewHeight, widgetWidth, widgetHeight );
				scale = 0.01;
			}
			console.log(`[MAC Draw DEBUG] Calculated scale: ${scale}`);

			let backgroundRenderWidth = previewWidth * scale;
			let backgroundRenderHeight = previewHeight * scale;
			console.log(`[MAC Draw DEBUG] BackgroundRender WxH: ${backgroundRenderWidth}x${backgroundRenderHeight}`);

			let xOffset = margin;
			if (backgroundRenderWidth < widgetWidth) {
				xOffset = (widgetWidth - backgroundRenderWidth) / 2;
			}
			let yOffset = margin;
			if (backgroundRenderHeight < widgetHeight) {
				yOffset = (widgetHeight - backgroundRenderHeight) / 2;
			}

			ctx.save();
			ctx.beginPath();
			ctx.rect(0, 0, widgetWidth, widgetHeight);
			ctx.clip();

			ctx.translate(xOffset, yOffset);

			ctx.fillStyle = "#000000";
			ctx.fillRect(-border, -border, backgroundRenderWidth + border * 2, backgroundRenderHeight + border * 2);

			ctx.fillStyle = globalThis.LiteGraph.NODE_DEFAULT_BGCOLOR;
			ctx.fillRect(0, 0, backgroundRenderWidth, backgroundRenderHeight);

			function getDrawArea(v) {
				let areaX = v[0] * scale;
				let areaY = v[1] * scale;
				let areaW = v[2] * scale;
				let areaH = v[3] * scale;

				if (areaX > backgroundRenderWidth) { areaX = backgroundRenderWidth; areaW = 0; }
				if (areaY > backgroundRenderHeight) { areaY = backgroundRenderHeight; areaH = 0; }

				if (areaX + areaW > backgroundRenderWidth) {
					areaW = Math.max(0, backgroundRenderWidth - areaX);
				}
				
				if (areaY + areaH > backgroundRenderHeight) {
					areaH = Math.max(0, backgroundRenderHeight - areaY);
				}
				return [areaX, areaY, areaW, areaH];
			}
            
			if (values && values.length > 0) {
			for (const [k, v] of values.entries()) {
					if (k == indexToUse || !v || v.length < 4) continue;

					const [rectX, rectY, rectW, rectH] = getDrawArea(v);
					if (rectW > 0 && rectH > 0) {
						ctx.fillStyle = getDrawColor(k/values.length, "80");
						ctx.fillRect(rectX, rectY, rectW, rectH);
					}
				}
			}

			ctx.beginPath();
			ctx.lineWidth = 1;
			const sixtyFourScaled = 64 * scale;
			for (let gx = 0; gx <= previewWidth; gx += 64) {
				ctx.moveTo(gx * scale, 0);
				ctx.lineTo(gx * scale, backgroundRenderHeight);
			}
			for (let gy = 0; gy <= previewHeight; gy += 64) {
				ctx.moveTo(0, gy * scale);
				ctx.lineTo(backgroundRenderWidth, gy * scale);
			}
			ctx.strokeStyle = "#00000050";
			ctx.stroke();
			ctx.closePath();

			if (values && indexToUse >= 0 && indexToUse < values.length) {
				const selectedValue = values[indexToUse];
				if (selectedValue && selectedValue.length >=4) {
					let [rectX, rectY, rectW, rectH] = getDrawArea(selectedValue);

					const minVisSize = 32 * scale;
					rectW = Math.max(minVisSize, rectW);
					rectH = Math.max(minVisSize, rectH);

					if (rectW > 0 && rectH > 0) {
						ctx.fillStyle = "#FFFFFF";
						ctx.fillRect(rectX, rectY, rectW, rectH);
						const selectedColor = getDrawColor(indexToUse/values.length, "FF");
						ctx.fillStyle = selectedColor;
						ctx.fillRect(rectX + border, rectY + border, rectW - border * 2, rectH - border * 2);
					}
				}
			}
			ctx.restore();
		},
	};

	node.addCustomWidget(widget);

	return { minWidth: 200, minHeight: 400, widget }
}

app.registerExtension({
	name: "Comfy.Davemane42.MultiAreaConditioning",
	async beforeRegisterNodeDef(nodeType, nodeData, app) {
		if (nodeData.name === "MultiAreaConditioning") {
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				console.log("[MAC DEBUG] onNodeCreated. Node ID:", this.id);
				const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

				this.setProperty("width", 512);
				this.setProperty("height", 512);
				this.setProperty("values", [[0, 0, 0, 0, 1.0], [0, 0, 0, 0, 1.0]]);

				this.selected = false;
				this.comfyWidgetIndexForAreaSelector = 2;

                this.serialize_widgets = true;

				this.updateIndexWidgetMax = function() {
					const areaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
					if (areaSelectorWidget) {
						const numInputs = this.inputs ? this.inputs.length : 0;
						const newMax = numInputs > 0 ? numInputs - 1 : 0;
						if (areaSelectorWidget.options.max !== newMax) {
							areaSelectorWidget.options.max = newMax;
							console.log(`[MAC updateIndexWidgetMax] Node ${this.id}: Set options.max to ${newMax}`);
						}
						let val = Number(areaSelectorWidget.value);
						if(isNaN(val)) val = 0;
						val = Math.round(val);
						if (val > newMax && newMax >= 0) { val = newMax; }
						if (val < 0 && numInputs > 0) { val = 0; }
						if (areaSelectorWidget.value !== val) areaSelectorWidget.value = val;

						if (this.onWidgetChanged) { this.onWidgetChanged(areaSelectorWidget.name, areaSelectorWidget.value, areaSelectorWidget.options); }
						this.setDirtyCanvas(true, true);
					} else {
						console.warn("[MultiAreaConditioning] updateIndexWidgetMax: Area selector widget not found at index", this.comfyWidgetIndexForAreaSelector);
					}
				};

				CUSTOM_INT(this, "resolutionX", 512, function (v, widget, node) {node.properties["width"] = Math.round(Number(v)); node.setDirtyCanvas(true,true); });
				CUSTOM_INT(this, "resolutionY", 512, function (v, widget, node) {node.properties["height"] = Math.round(Number(v)); node.setDirtyCanvas(true,true); });
				
				let initialMaxIndex = this.inputs ? (this.inputs.length > 0 ? this.inputs.length - 1 : 0) : 0;
				if (initialMaxIndex < 0) initialMaxIndex = 0; // Should not happen with 2 default inputs

				CUSTOM_INT(this, "index", 0, function (rawValue, widget, node) {
					let processedValue = Number(rawValue);
					let currentValue = Number(widget.value);

					let finalSanitizedIndex = 0;

					if (!isNaN(currentValue)) {
						finalSanitizedIndex = Math.round(currentValue);
					} else if (!isNaN(processedValue)) {
						finalSanitizedIndex = Math.round(processedValue);
					} else {
						console.warn(`[MAC Index CB] Both rawValue '${rawValue}' and widget.value '${widget.value}' are unusable. Defaulting to 0.`);
					}
					
					const currentMax = (widget.options && widget.options.max !== null && typeof widget.options.max !== 'undefined') 
									   ? widget.options.max 
									   : (node.inputs.length > 0 ? node.inputs.length -1 : 0);

					if (finalSanitizedIndex < 0) finalSanitizedIndex = 0;
					if (finalSanitizedIndex > currentMax && currentMax >=0) finalSanitizedIndex = currentMax;
					
					if (widget.value !== finalSanitizedIndex) {
						widget.value = finalSanitizedIndex;
					}

					console.log(`[MAC DEBUG] Index CB Final. Index: ${widget.value}, OptMax: ${widget.options.max}, Inputs: ${node.inputs.length}`);
					
					let values = node.properties["values"];
					if (values && widget.value >= 0 && widget.value < values.length && values[widget.value]) {
						node.widgets[3].value = values[widget.value][0];
						node.widgets[4].value = values[widget.value][1];
						node.widgets[5].value = values[widget.value][2];
						node.widgets[6].value = values[widget.value][3];
						if (values[widget.value].length <= 4 || values[widget.value][4] === undefined) { values[widget.value][4] = 1.0; }
						node.widgets[7].value = values[widget.value][4];
					} else {
						console.warn(`[MAC Index CB] values[${widget.value}] out of bounds. Values len: ${values ? values.length : 'N/A'}.`);
					}
					node.setDirtyCanvas(true, true);
				}, { step: 1, max: initialMaxIndex, precision: 0 });
				
				CUSTOM_INT(this, "x", 0, function (v, widget, node) {transformFunc(widget, v, node, 0);});
				CUSTOM_INT(this, "y", 0, function (v, widget, node) {transformFunc(widget, v, node, 1);});
				CUSTOM_INT(this, "width", 0, function (v, widget, node) {transformFunc(widget, v, node, 2);});
				CUSTOM_INT(this, "height", 0, function (v, widget, node) {transformFunc(widget, v, node, 3);});
				CUSTOM_INT(this, "strength", 1.0, function (v, widget, node) {transformFunc(widget, v, node, 4);}, {"min": 0.0, "max": 10.0, "step": 0.1, "precision": 2});

				addMultiAreaConditioningCanvas(this, app);

				// After all widgets are added, compute the node's ideal size
				// This will take into account the customCanvas's computeSize() request for 200px height.
				this.size = this.computeSize(); // Recompute and set node size
				this.setDirtyCanvas(true, true); // Ensure redraw with new size

				console.log(`[MAC DEBUG] Node ${this.id} onNodeCreated: Size after computeSize: W=${this.size[0]}, H=${this.size[1]}`);

				this.updateIndexWidgetMax();

				this.getExtraMenuOptions = function(_, options) {
					const areaIndexValue = this.widgets[this.comfyWidgetIndexForAreaSelector] ? this.widgets[this.comfyWidgetIndexForAreaSelector].value : "N/A";
					options.unshift(
						{
							content: `insert input above ${areaIndexValue} /\\`,
							callback: () => {
								const currentSelectedAreaIndex = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								this.addInput("conditioning", "CONDITIONING");
								
								for (let i = this.inputs.length - 1; i > currentSelectedAreaIndex; i--) {
									swapInputs(this, i, i - 1);
								}
								renameNodeInputs(this, "conditioning");

								this.properties["values"].splice(currentSelectedAreaIndex, 0, [0, 0, 0, 0, 1.0]);
								this.updateIndexWidgetMax();
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: `insert input below ${areaIndexValue} \\/`,
							callback: () => {
								const currentSelectedAreaIndex = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								this.addInput("conditioning", "CONDITIONING");

								for (let i = this.inputs.length - 1; i > currentSelectedAreaIndex + 1; i--) {
									swapInputs(this, i, i - 1);
								}
								renameNodeInputs(this, "conditioning");

								this.properties["values"].splice(currentSelectedAreaIndex + 1, 0, [0, 0, 0, 0, 1.0]);
								this.updateIndexWidgetMax();
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: `swap with input above ${areaIndexValue} /\\`,
							callback: () => {
								const index = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (index !== 0) {
									swapInputs(this, index, index-1);
									renameNodeInputs(this, "conditioning");
									this.properties["values"].splice(index-1,0,this.properties["values"].splice(index,1)[0]);
									this.widgets[this.comfyWidgetIndexForAreaSelector].value = index-1;
									this.updateIndexWidgetMax();
									this.setDirtyCanvas(true, true);
								}
							},
						},
						{
							content: `swap with input below ${areaIndexValue} \\/`,
							callback: () => {
								const index = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (index !== this.inputs.length-1) {
									swapInputs(this, index, index+1);
									renameNodeInputs(this, "conditioning");
									this.properties["values"].splice(index+1,0,this.properties["values"].splice(index,1)[0]);
									this.widgets[this.comfyWidgetIndexForAreaSelector].value = index+1;
									this.updateIndexWidgetMax();
									this.setDirtyCanvas(true, true);
								}
							},
						},
						{
							content: `remove currently selected input ${areaIndexValue}`,
							callback: () => {
								const indexToRemove = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (this.inputs.length <= 2) { 
									console.log("[MultiAreaConditioning] Cannot remove input, minimum of 2 required."); 
									return; 
								}
								removeNodeInputs(this, [indexToRemove]); 
								renameNodeInputs(this, "conditioning");
								this.updateIndexWidgetMax(); 
								const currentAreaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
								if (currentAreaSelectorWidget && currentAreaSelectorWidget.callback) {
									currentAreaSelectorWidget.callback(currentAreaSelectorWidget.value, currentAreaSelectorWidget, this);
								}
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: "remove all unconnected inputs",
							callback: () => {
								let indexesToRemove = [];
								for (let i = 0; i < this.inputs.length; i++) {
									if (!this.inputs[i].link) {
										if (this.inputs.length - indexesToRemove.length > 2) {
											indexesToRemove.push(i);
										} else {
											console.log("[MultiAreaConditioning] Skipping removal of unconnected input to maintain minimum of 2.");
										}
									}
								}

								if (indexesToRemove.length) {
									removeNodeInputs(this, indexesToRemove);
									renameNodeInputs(this, "conditioning");
									this.updateIndexWidgetMax();
									const currentAreaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
									if (currentAreaSelectorWidget && currentAreaSelectorWidget.callback) {
										currentAreaSelectorWidget.callback(currentAreaSelectorWidget.value, currentAreaSelectorWidget, this);
									}
									this.setDirtyCanvas(true, true);
								}
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
					this.selected = true;
					this.setDirtyCanvas(true,true);
				}
				this.onDeselected = function () {
					this.selected = false;
					this.setDirtyCanvas(true,true);
				}

				return r;
			};
		}
	},
	loadedGraphNode(node, _) {
		if (node.type === "MultiAreaConditioning") {
			node.comfyWidgetIndexForAreaSelector = 2;
			if (typeof node.updateIndexWidgetMax !== 'function') {
				node.updateIndexWidgetMax = function() {
					const areaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
					if (areaSelectorWidget) {
						const numInputs = this.inputs ? this.inputs.length : 0;
						const newMax = numInputs > 0 ? numInputs - 1 : 0;
						if(areaSelectorWidget.options.max !== newMax) areaSelectorWidget.options.max = newMax;
						let val = Number(areaSelectorWidget.value); if(isNaN(val)) val = 0; val = Math.round(val);
						if (val > newMax && newMax >=0) val = newMax;
						if (val < 0 && numInputs > 0) val = 0;
						if(areaSelectorWidget.value !== val) areaSelectorWidget.value = val;
						if (this.onWidgetChanged) { this.onWidgetChanged(areaSelectorWidget.name, areaSelectorWidget.value, areaSelectorWidget.options);}
						this.setDirtyCanvas(true, true);
					} else { console.warn("[MAC] updateIndexWidgetMax (fallback): Area selector not found"); }
				};
			}
			node.updateIndexWidgetMax();
			const indexWidgetInst = node.widgets[node.comfyWidgetIndexForAreaSelector];
			if (indexWidgetInst) {
				 indexWidgetInst.value = Math.round(Number(indexWidgetInst.value || 0));
				 if (indexWidgetInst.value < 0) indexWidgetInst.value = 0;
				 indexWidgetInst.options.step = 1;
				 indexWidgetInst.options.precision = 0;
			}
			if(indexWidgetInst && indexWidgetInst.callback) {
				indexWidgetInst.callback(indexWidgetInst.value, indexWidgetInst, node);
			}
		}
	},
	
});