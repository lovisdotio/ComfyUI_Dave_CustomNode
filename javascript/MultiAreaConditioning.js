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
		draw: function (ctx, node, widgetWidth, widgetY) {
			console.log("[MultiAreaConditioning DEBUG] widget.draw called for node:", node.id, "widgetWidth:", widgetWidth, "widgetY:", widgetY);
			
			// If we are initially offscreen when created we wont have received a resize event
			// Calculate it here instead
			if (!node.canvasHeight) {
				console.log("[MultiAreaConditioning DEBUG] node.canvasHeight not set, calling computeCanvasSize.");
				computeCanvasSize(node, node.size);
			}
			console.log("[MultiAreaConditioning DEBUG] node.canvasHeight:", node.canvasHeight, "node.size:", node.size);

			const visible = true //app.canvasblank.ds.scale > 0.5 && this.type === "customCanvas";
			const t = ctx.getTransform();
			const margin = 10
			const border = 2

			const widgetHeight = node.canvasHeight
            const values = node.properties["values"]
			const width = Math.round(node.properties["width"])
			const height = Math.round(node.properties["height"])

			console.log("[MultiAreaConditioning DEBUG] Drawing params: width:", width, "height:", height, "widgetHeight (node.canvasHeight):", widgetHeight);

			const scale = Math.min((widgetWidth-margin*2)/width, (widgetHeight-margin*2)/height)
			console.log("[MultiAreaConditioning DEBUG] Calculated scale:", scale);

            // Verbose check for the area selector widget and its value
            const widgetIndex = node.comfyWidgetIndexForAreaSelector;
            console.log(`[MultiAreaConditioning DEBUG] Draw: Accessing widget at index: ${widgetIndex}. Total widgets: ${node.widgets ? node.widgets.length : 'N/A'}`);

            const areaSelectorWidget = node.widgets && node.widgets[widgetIndex];

            if (!areaSelectorWidget) {
                console.warn(`[MultiAreaConditioning DEBUG] Draw function: Area selector widget at index ${widgetIndex} is NOT FOUND. Node ID:`, node.id, "Available widgets:", JSON.stringify(node.widgets ? node.widgets.map(w => ({name: w.name, type: w.type})) : []));
                if (this.canvas) this.canvas.hidden = true;
                return; // Exit draw to prevent error
            }
            
            console.log(`[MultiAreaConditioning DEBUG] Draw: Found widget: ${areaSelectorWidget.name}, type: ${areaSelectorWidget.type}, value: ${areaSelectorWidget.value}, typeof value: ${typeof areaSelectorWidget.value}`);

            if (typeof areaSelectorWidget.value === 'undefined' || areaSelectorWidget.value === null) { // Check for null explicitly too
                 console.warn(`[MultiAreaConditioning DEBUG] Draw function: Area selector widget's value is undefined or null. Widget name: ${areaSelectorWidget.name}. Node ID:`, node.id);
                if (this.canvas) this.canvas.hidden = true;
                return; 
            }

            // Attempt to get the value and ensure it's a number before Math.round
            let numericValue = parseFloat(areaSelectorWidget.value);
            if (isNaN(numericValue)) {
                console.error(`[MultiAreaConditioning DEBUG] Draw function: Area selector widget's value is not a number: ${areaSelectorWidget.value}. Widget name: ${areaSelectorWidget.name}. Node ID:`, node.id);
                if (this.canvas) this.canvas.hidden = true;
                return;
            }
            const index = Math.round(numericValue);
            console.log(`[MultiAreaConditioning DEBUG] Draw: Successfully got index: ${index}`);

			Object.assign(this.canvas.style, {
				left: `${t.e}px`,
				top: `${t.f + (widgetY*t.d)}px`,
				width: `${widgetWidth * t.a}px`,
				height: `${widgetHeight * t.d}px`,
				position: "absolute",
				zIndex: 1000,
				fontSize: `${t.d * 10.0}px`,
			});
			console.log("[MultiAreaConditioning DEBUG] Canvas style applied. transform_e:", t.e, "transform_f:", t.f, "transform_d:", t.d, "widgetWidth_transform_a:", widgetWidth * t.a);

			this.canvas.hidden = !visible;
			console.log("[MultiAreaConditioning DEBUG] Canvas hidden:", this.canvas.hidden);

            let backgroudWidth = width * scale
            let backgroundHeight = height * scale

			let xOffset = margin
			if (backgroudWidth < widgetWidth) {
				xOffset += (widgetWidth-backgroudWidth)/2 - margin
			}
			let yOffset = margin
			if (backgroundHeight < widgetHeight) {
				yOffset += (widgetHeight-backgroundHeight)/2 - margin
			}

			let widgetX = xOffset
			widgetY = widgetY + yOffset

			ctx.fillStyle = "#000000"
			ctx.fillRect(widgetX-border, widgetY-border, backgroudWidth+border*2, backgroundHeight+border*2)

			ctx.fillStyle = globalThis.LiteGraph.NODE_DEFAULT_BGCOLOR
			ctx.fillRect(widgetX, widgetY, backgroudWidth, backgroundHeight);

			function getDrawArea(v) {
				let x = v[0]*backgroudWidth/width
				let y = v[1]*backgroundHeight/height
				let w = v[2]*backgroudWidth/width
				let h = v[3]*backgroundHeight/height

				if (x > backgroudWidth) { x = backgroudWidth}
				if (y > backgroundHeight) { y = backgroundHeight}

				if (x+w > backgroudWidth) {
					w = Math.max(0, backgroudWidth-x)
				}
				
				if (y+h > backgroundHeight) {
					h = Math.max(0, backgroundHeight-y)
				}

				return [x, y, w, h]
			}
            
			// Draw all the conditioning zones
			for (const [k, v] of values.entries()) {

				if (k == index) {continue}

				const [x, y, w, h] = getDrawArea(v)

				ctx.fillStyle = getDrawColor(k/values.length, "80") //colors[k] + "B0"
				ctx.fillRect(widgetX+x, widgetY+y, w, h)

			}

			ctx.beginPath();
			ctx.lineWidth = 1;

			for (let x = 0; x <= width/64; x += 1) {
				ctx.moveTo(widgetX+x*64*scale, widgetY);
				ctx.lineTo(widgetX+x*64*scale, widgetY+backgroundHeight);
			}

			for (let y = 0; y <= height/64; y += 1) {
				ctx.moveTo(widgetX, widgetY+y*64*scale);
				ctx.lineTo(widgetX+backgroudWidth, widgetY+y*64*scale);
			}

			ctx.strokeStyle = "#00000050";
			ctx.stroke();
			ctx.closePath();

			// Draw currently selected zone
			console.log(index)
			let [x, y, w, h] = getDrawArea(values[index])

			w = Math.max(32*scale, w)
			h = Math.max(32*scale, h)

			//ctx.fillStyle = "#"+(Number(`0x1${colors[index].substring(1)}`) ^ 0xFFFFFF).toString(16).substring(1).toUpperCase()
			ctx.fillStyle = "#ffffff"
			ctx.fillRect(widgetX+x, widgetY+y, w, h)

			const selectedColor = getDrawColor(index/values.length, "FF")
			ctx.fillStyle = selectedColor
			ctx.fillRect(widgetX+x+border, widgetY+y+border, w-border*2, h-border*2)

			// Display
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
		// Draw node isnt fired once the node is off the screen
		// if it goes off screen quickly, the input may not be removed
		// this shifts it off screen so it can be moved back if the node is visible.
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

				this.setProperty("width", 512);
				this.setProperty("height", 512);
				this.setProperty("values", [[0, 0, 0, 0, 1.0], [0, 0, 0, 0, 1.0]]);

				this.selected = false;
				this.comfyWidgetIndexForAreaSelector = 3; // Widget holding the current area index (0-indexed)

                this.serialize_widgets = true;

                this.updateIndexWidgetMax = function() {
                    const areaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
                    if (areaSelectorWidget) {
                        const numInputs = this.inputs ? this.inputs.length : 0;
                        const newMax = numInputs > 0 ? numInputs - 1 : 0;
                        areaSelectorWidget.options.max = newMax;
                        
                        if (areaSelectorWidget.value > newMax) {
                            areaSelectorWidget.value = newMax;
                        }
                        // Force LiteGraph to notice the widget options change, hopefully redrawing it.
                        if (this.onWidgetChanged) { 
                            this.onWidgetChanged(areaSelectorWidget.name, areaSelectorWidget.value, areaSelectorWidget.options);
                        }
                        this.setDirtyCanvas(true, true); // Crucial for UI to update widget visuals
                    } else {
                        console.warn("[MultiAreaConditioning] updateIndexWidgetMax: Area selector widget not found at index", this.comfyWidgetIndexForAreaSelector);
                    }
                };

				CUSTOM_INT(this, "resolutionX", 512, function (v, _, node) {const s = this.options.step / 10; this.value = Math.round(v / s) * s; node.properties["width"] = this.value; node.setDirtyCanvas(true,true); });
				CUSTOM_INT(this, "resolutionY", 512, function (v, _, node) {const s = this.options.step / 10; this.value = Math.round(v / s) * s; node.properties["height"] = this.value; node.setDirtyCanvas(true,true); });
                
				addMultiAreaConditioningCanvas(this, app);

				const initialMaxIndex = this.inputs ? (this.inputs.length > 0 ? this.inputs.length - 1 : 0) : 0;
				CUSTOM_INT(
					this,
					"index", // This is the area selector widget
					0,
					function (v, widget, node) { // v is the new index value
						let values = node.properties["values"];
                        if (values && v >= 0 && v < values.length && values[v]) {
                            node.widgets[4].value = values[v][0]; // x
                            node.widgets[5].value = values[v][1]; // y
                            node.widgets[6].value = values[v][2]; // width
                            node.widgets[7].value = values[v][3]; // height
                            if (values[v].length <= 4 || values[v][4] === undefined) {values[v][4] = 1.0;} // Ensure strength exists
                            node.widgets[8].value = values[v][4]; // strength
                        } else {
                            console.warn(`[MultiAreaConditioning] Index widget callback: Attempted to access values[${v}] but it's out of bounds or undefined. Current values:`, JSON.stringify(values));
                        }
                        node.setDirtyCanvas(true, true); // Redraw canvas for visual feedback
					},
					{ step: 1, max: initialMaxIndex } 
				);
				
				CUSTOM_INT(this, "x", 0, function (v, widget, node) {transformFunc(widget, v, node, 0);});
				CUSTOM_INT(this, "y", 0, function (v, widget, node) {transformFunc(widget, v, node, 1);});
				CUSTOM_INT(this, "width", 0, function (v, widget, node) {transformFunc(widget, v, node, 2);});
				CUSTOM_INT(this, "height", 0, function (v, widget, node) {transformFunc(widget, v, node, 3);});
				CUSTOM_INT(this, "strength", 1, function (v, widget, node) {transformFunc(widget, v, node, 4);}, {"min": 0.0, "max": 10.0, "step": 0.1, "precision": 2});

                this.updateIndexWidgetMax(); // Initial call to set max correctly

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
                                    this.updateIndexWidgetMax(); // Max doesn't change, but value might need refresh if it was at max
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
                                // Prevent removing if only two inputs are left (as per original removeNodeInputs logic)
                                if (this.inputs.length <= 2) { 
                                    console.log("[MultiAreaConditioning] Cannot remove input, minimum of 2 required."); 
                                    return; 
                                }
								removeNodeInputs(this, [indexToRemove]); 
								renameNodeInputs(this, "conditioning");
                                this.updateIndexWidgetMax(); 
                                // Callback for index widget might need to be manually triggered if value changed due to removal
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
                                        // Check if we can remove this input (don't go below 2 inputs)
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
            // Manually re-create the helper function if it doesn't exist (e.g. loading old graph)
            if (typeof node.updateIndexWidgetMax !== 'function') {
                node.comfyWidgetIndexForAreaSelector = 3; // Default assumption
                node.updateIndexWidgetMax = function() {
                    const areaSelectorWidget = this.widgets[this.comfyWidgetIndexForAreaSelector];
                    if (areaSelectorWidget) {
                        const numInputs = this.inputs ? this.inputs.length : 0;
                        const newMax = numInputs > 0 ? numInputs - 1 : 0;
                        areaSelectorWidget.options.max = newMax;
                        if (areaSelectorWidget.value > newMax) {
                            areaSelectorWidget.value = newMax;
                        }
                        if (this.onWidgetChanged) { 
                            this.onWidgetChanged(areaSelectorWidget.name, areaSelectorWidget.value, areaSelectorWidget.options);
                        }
                        this.setDirtyCanvas(true, true);
                    } else {
                        console.warn("[MultiAreaConditioning] updateIndexWidgetMax (fallback): Area selector widget not found at index", this.comfyWidgetIndexForAreaSelector);
                    }
                };
            }
            node.updateIndexWidgetMax();
		}
	},
	
});