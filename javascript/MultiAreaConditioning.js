console.log("[MultiAreaConditioning DEBUG] MultiAreaConditioning.js loaded");
import { app } from "/scripts/app.js";
import {CUSTOM_INT, recursiveLinkUpstream, transformFunc, swapInputs, renameNodeInputs, removeNodeInputs, getDrawColor} from "./utils.js"

function addMultiAreaConditioningCanvas(node, app) {
	console.log("[MAC DEBUG] addMultiAreaConditioningCanvas for node:", node.id);

	const widget = {
		type: "customCanvas",
		name: "MultiAreaConditioning-Canvas",
		computeSize: function(node_width) { // LiteGraph typically passes the node's current width
			const G_NODE_WIDGET_PADDING_LEFT = 4; // Typical LiteGraph padding, adjust if needed
			const G_NODE_WIDGET_PADDING_RIGHT = 4;
			let width = node_width - G_NODE_WIDGET_PADDING_LEFT - G_NODE_WIDGET_PADDING_RIGHT;
			if (width < 0) width = 0;
			const height = 200; // Our desired height
			
			this.size = [width, height]; // IMPORTANT: Set the widget's own size property
			// console.log(`[MAC DEBUG] computeSize for ${this.name} (node_width: ${node_width}) returning & setting this.size to: [${this.size[0]}, ${this.size[1]}]`);
			return this.size; // Return [width, height]
		},
		draw: function (ctx, node, widgetWidth, widgetY, widgetHeight) { 
			// widgetWidth, widgetHeight are what LiteGraph decided to give us based on computeSize and node layout
			if (widgetWidth <= 0 || widgetHeight <= 0) { return; }
			// console.log(`[MAC Draw DEBUG] Entry: WW: ${widgetWidth}, WH: ${widgetHeight}, NodeID: ${node.id}`);
			const margin = 5; const border = 2;
			const values = node.properties["values"];
			const previewWidth = Math.round(node.properties["width"]); 
			const previewHeight = Math.round(node.properties["height"]); 
			// if(node.id === 10) console.log(`[MAC Draw DEBUG Node 10] Preview Res: ${previewWidth}x${previewHeight}`);

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
				 // console.warn("[MAC Draw DEBUG] Zero dimension for scale calc.");
			}
			if (scale <= 0) { scale = 0.01; 
				// console.warn("[MAC Draw DEBUG] Scale <=0, clamped.");
			}
			// if(node.id === 10) console.log(`[MAC Draw DEBUG Node 10] Scale: ${scale}`);
			let backgroundRenderWidth = previewWidth * scale;
			let backgroundRenderHeight = previewHeight * scale;
			// if(node.id === 10) console.log(`[MAC Draw DEBUG Node 10] BgRender WxH: ${backgroundRenderWidth}x${backgroundRenderHeight}`);

			let xOffset = margin; if (backgroundRenderWidth < widgetWidth) { xOffset = (widgetWidth - backgroundRenderWidth) / 2; }
			let yOffset = margin; if (backgroundRenderHeight < widgetHeight) { yOffset = (widgetHeight - backgroundRenderHeight) / 2; }
			ctx.save(); ctx.beginPath(); ctx.rect(0, 0, widgetWidth, widgetHeight); ctx.clip();
			ctx.translate(xOffset, yOffset);
			ctx.fillStyle = "#000000"; ctx.fillRect(-border, -border, backgroundRenderWidth + border * 2, backgroundRenderHeight + border * 2);
			ctx.fillStyle = globalThis.LiteGraph.NODE_DEFAULT_BGCOLOR; ctx.fillRect(0, 0, backgroundRenderWidth, backgroundRenderHeight);
			function getDrawArea(v) { let ax=v[0]*scale,ay=v[1]*scale,aw=v[2]*scale,ah=v[3]*scale; if(ax>backgroundRenderWidth){ax=backgroundRenderWidth;aw=0;} if(ay>backgroundRenderHeight){ay=backgroundRenderHeight;ah=0;} if(ax+aw>backgroundRenderWidth){aw=Math.max(0,backgroundRenderWidth-ax);} if(ay+ah>backgroundRenderHeight){ah=Math.max(0,backgroundRenderHeight-ay);} return [ax,ay,aw,ah];}
			if (values && values.length > 0) { for (const [k, v] of values.entries()) { if (k == indexToUse || !v || v.length < 4) continue; const [rx,ry,rw,rh]=getDrawArea(v); if (rw>0&&rh>0){ctx.fillStyle=getDrawColor(k/values.length,"80"); ctx.fillRect(rx,ry,rw,rh);}}} ctx.beginPath(); ctx.lineWidth=1;
			for (let gx=0;gx<=previewWidth;gx+=64){ctx.moveTo(gx*scale,0);ctx.lineTo(gx*scale,backgroundRenderHeight);} for(let gy=0;gy<=previewHeight;gy+=64){ctx.moveTo(0,gy*scale);ctx.lineTo(backgroundRenderWidth,gy*scale);} ctx.strokeStyle="#00000050";ctx.stroke();ctx.closePath();
			if(values&&indexToUse>=0&&indexToUse<values.length){const selV=values[indexToUse];if(selV&&selV.length>=4){let [rx,ry,rw,rh]=getDrawArea(selV);const mvs=32*scale;rw=Math.max(mvs,rw);rh=Math.max(mvs,rh);if(rw>0&&rh>0){ctx.fillStyle="#FFFFFF";ctx.fillRect(rx,ry,rw,rh);const selC=getDrawColor(indexToUse/values.length,"FF");ctx.fillStyle=selC;ctx.fillRect(rx+border,ry+border,rw-border*2,rh-border*2);}}} ctx.restore();
		},
	};

	node.addCustomWidget(widget);

	return { minWidth: 300, minHeight: 450, widget }
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
						// Ensure options object exists
						areaSelectorWidget.options = areaSelectorWidget.options || {}; 
						if (areaSelectorWidget.options.max !== newMax) {
							areaSelectorWidget.options.max = newMax;
							// console.log(`[MAC updateIndexWidgetMax] Node ${this.id}: Set options.max to ${newMax}`);
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
					let finalSanitizedIndex = 0;
					let vToConsider = rawValue;
					// Prioritize widget.value if callback is re-entrant or value was set directly
					if (widget.value !== null && typeof widget.value !== 'undefined' && !isNaN(Number(widget.value))) {
						vToConsider = widget.value;
					}
					let numVal = Number(vToConsider);
					if (!isNaN(numVal)) finalSanitizedIndex = Math.round(numVal);
					else console.warn(`[MAC Index CB] vToConsider '${vToConsider}' is NaN. Defaulting to 0.`);
					
					const currentMax = (widget.options && widget.options.max !== null && typeof widget.options.max !== 'undefined') 
										   ? widget.options.max 
										   : (node.inputs.length > 0 ? node.inputs.length -1 : 0);
					if (finalSanitizedIndex < 0) finalSanitizedIndex = 0;
					if (finalSanitizedIndex > currentMax && currentMax >=0) finalSanitizedIndex = currentMax;
					if (widget.value !== finalSanitizedIndex) widget.value = finalSanitizedIndex;

					// console.log(`[MAC DEBUG] Index CB Final. Index: ${widget.value}, OptMax: ${widget.options.max}, Inputs: ${node.inputs.length}`);
					let values = node.properties["values"];
					if (values && widget.value >= 0 && widget.value < values.length && values[widget.value]) {
						node.widgets[3].value = values[widget.value][0];
						node.widgets[4].value = values[widget.value][1];
						node.widgets[5].value = values[widget.value][2];
						node.widgets[6].value = values[widget.value][3]; 
						if (values[widget.value].length <= 4 || values[widget.value][4] === undefined) { values[widget.value][4] = 1.0; }
						node.widgets[7].value = values[widget.value][4]; 
					} else { /* console.warn(`[MAC Index CB] values[${widget.value}] out of bounds.`); */ }
					node.setDirtyCanvas(true, true);
				}, { step: 1, max: initialMaxIndex, precision: 0 });
				
				const indexWidgetInst = this.widgets[this.comfyWidgetIndexForAreaSelector];
				if (indexWidgetInst) {
					indexWidgetInst.value = 0; indexWidgetInst.options.step = 1; indexWidgetInst.options.precision = 0;
					// console.log(`[MAC DEBUG] Post-create Index Widget: Val: ${indexWidgetInst.value}, OptMax: ${indexWidgetInst.options.max}, OptStep: ${indexWidgetInst.options.step}`);
				} else { console.error("[MAC DEBUG] Index widget instance not found post-creation!"); }
				
				this.updateIndexWidgetMax(); // Set initial correct max for index widget
				
				// Manually trigger callback for index widget to populate x,y,w,h based on initial index 0
				if (indexWidgetInst && indexWidgetInst.callback) {
					indexWidgetInst.callback(indexWidgetInst.value, indexWidgetInst, this);
				}

				CUSTOM_INT(this, "x", 0, function (v, widget, node) {transformFunc(widget, v, node, 0);});
				CUSTOM_INT(this, "y", 0, function (v, widget, node) {transformFunc(widget, v, node, 1);});
				CUSTOM_INT(this, "width", 0, function (v, widget, node) {transformFunc(widget, v, node, 2);});
				CUSTOM_INT(this, "height", 0, function (v, widget, node) {transformFunc(widget, v, node, 3);});
				CUSTOM_INT(this, "strength", 1.0, function (v, widget, node) {transformFunc(widget, v, node, 4);}, {"min": 0.0, "max": 10.0, "step": 0.1, "precision": 2});

				addMultiAreaConditioningCanvas(this, app);
				
				// After ALL widgets are added, including custom ones, tell the node to compute its size.
				this.size = this.computeSize();
				this.setDirtyCanvas(true, true);
				// console.log(`[MAC DEBUG] Node ${this.id} onNodeCreated: Final Size: W=${this.size[0]}, H=${this.size[1]}`);

				this.updateIndexWidgetMax(); // Call again to be safe after node resize might have affected widget options.

				this.getExtraMenuOptions = function(_, options) {
					const areaIndexValue = this.widgets[this.comfyWidgetIndexForAreaSelector] ? this.widgets[this.comfyWidgetIndexForAreaSelector].value : "N/A";
					options.unshift(
						{
							content: `insert input above ${areaIndexValue} /\\`,
							callback: () => {
								const curIdx = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								this.addInput("conditioning", "CONDITIONING");
								
								for (let i = this.inputs.length - 1; i > curIdx; i--) {
									swapInputs(this, i, i - 1);
								}
								renameNodeInputs(this, "conditioning");

								this.properties["values"].splice(curIdx, 0, [0, 0, 0, 0, 1.0]);
								this.updateIndexWidgetMax();
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: `insert input below ${areaIndexValue} \\/`,
							callback: () => {
								const curIdx = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								this.addInput("conditioning", "CONDITIONING");

								for (let i = this.inputs.length - 1; i > curIdx + 1; i--) {
									swapInputs(this, i, i - 1);
								}
								renameNodeInputs(this, "conditioning");

								this.properties["values"].splice(curIdx + 1, 0, [0, 0, 0, 0, 1.0]);
								this.updateIndexWidgetMax();
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: `swap with input above ${areaIndexValue} /\\`,
							callback: () => {
								const idx = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (idx !== 0) {
									swapInputs(this, idx, idx-1);
									renameNodeInputs(this, "conditioning");
									this.properties["values"].splice(idx-1,0,this.properties["values"].splice(idx,1)[0]);
									this.widgets[this.comfyWidgetIndexForAreaSelector].value = idx-1;
									this.updateIndexWidgetMax();
									this.setDirtyCanvas(true, true);
								}
							},
						},
						{
							content: `swap with input below ${areaIndexValue} \\/`,
							callback: () => {
								const idx = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (idx !== this.inputs.length-1) {
									swapInputs(this, idx, idx+1);
									renameNodeInputs(this, "conditioning");
									this.properties["values"].splice(idx+1,0,this.properties["values"].splice(idx,1)[0]);
									this.widgets[this.comfyWidgetIndexForAreaSelector].value = idx+1;
									this.updateIndexWidgetMax();
									this.setDirtyCanvas(true, true);
								}
							},
						},
						{
							content: `remove currently selected input ${areaIndexValue}`,
							callback: () => {
								const idxToRemove = this.widgets[this.comfyWidgetIndexForAreaSelector].value;
								if (this.inputs.length <= 2) { console.log("[MAC] Min 2 inputs required."); return; }
								removeNodeInputs(this, [idxToRemove]); 
								renameNodeInputs(this, "conditioning");
								this.updateIndexWidgetMax(); 
								const widget = this.widgets[this.comfyWidgetIndexForAreaSelector];
								if (widget && widget.callback) {
									widget.callback(widget.value, widget, this);
								}
								this.setDirtyCanvas(true, true);
							},
						},
						{
							content: "remove all unconnected inputs",
							callback: () => {
								let toRemove = [];
								for (let i=0; i<this.inputs.length; i++) {
									if (!this.inputs[i].link && (this.inputs.length - toRemove.length > 2)) {
										toRemove.push(i);
									}
								}

								if (toRemove.length) {
									removeNodeInputs(this, toRemove);
									renameNodeInputs(this, "conditioning");
									this.updateIndexWidgetMax();
									const widget = this.widgets[this.comfyWidgetIndexForAreaSelector];
									if (widget && widget.callback) {
										widget.callback(widget.value, widget, this);
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
						areaSelectorWidget.options = areaSelectorWidget.options || {}; 
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
				 indexWidgetInst.options = indexWidgetInst.options || {};
				 indexWidgetInst.options.step = 1;
				 indexWidgetInst.options.precision = 0;
			}
			if(indexWidgetInst && indexWidgetInst.callback) {
				indexWidgetInst.callback(indexWidgetInst.value, indexWidgetInst, node);
			}
		}
	},
	
});