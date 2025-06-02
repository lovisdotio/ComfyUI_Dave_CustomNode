console.log("[MultiAreaConditioning DEBUG] utils.js loaded");

export function CUSTOM_INT(node, inputName, val, func, config = {}) {
	return {
		widget: node.addWidget(
			"number",
			inputName,
			val,
			func,
			Object.assign({}, { min: 0, max: 4096, step: 1, precision: 0 }, config)
		),
	};
}

export function recursiveLinkUpstream(node, type, depth, index = null) {
	depth += 1
	let connections = []
	const inputList = (index !== null) ? [index] : [...Array(node.inputs.length).keys()]
	if (inputList.length === 0) { return connections }
	for (let i of inputList) {
		const link = node.inputs[i].link
		if (link) {
			const nodeID = node.graph.links[link].origin_id
			const slotID = node.graph.links[link].origin_slot
			const connectedNode = node.graph._nodes_by_id[nodeID]

			if (connectedNode.outputs[slotID].type === type) {
				connections.push([connectedNode.id, depth])
				if (connectedNode.inputs) {
					const nextIndex = (connectedNode.type === "LatentComposite") ? 0 : null
					connections = connections.concat(recursiveLinkUpstream(connectedNode, type, depth, nextIndex))
				}
			}
		}
	}
	return connections
}

export function transformFunc(widget, value, node, propertyIndexToChange) {
	let selectedAreaIndex = 0;
	const areaSelectorWidgetIdx = node.comfyWidgetIndexForAreaSelector;
	const areaSelectorWidget = node.widgets && node.widgets[areaSelectorWidgetIdx];

	if (areaSelectorWidget && areaSelectorWidget.name === "index" &&
		areaSelectorWidget.value !== null && typeof areaSelectorWidget.value !== 'undefined') {
		let numVal = Number(areaSelectorWidget.value);
		if (!isNaN(numVal)) {
			selectedAreaIndex = Math.round(numVal);
		} else {
			console.warn(`[transformFunc] areaSelectorWidget.value ('${areaSelectorWidget.value}') is NaN. Defaulting selectedAreaIndex to 0.`);
		}
	} else {
		console.warn(`[transformFunc] Area selector widget (name: ${areaSelectorWidget ? areaSelectorWidget.name : 'N/A'}) value issue or widget not found. Defaulting selectedAreaIndex to 0.`);
	}

	let processedValue = Number(value);
	if (isNaN(processedValue)) {
		console.warn(`[transformFunc] Input 'value' ("${value}") for widget ${widget.name} is NaN. Using current widget value or 0.`);
		processedValue = Number(widget.value) || 0;
	}

	if (widget.options && typeof widget.options.precision === 'number') {
		if (widget.options.precision === 0) {
			widget.value = Math.round(processedValue);
		} else {
			widget.value = parseFloat(processedValue.toFixed(widget.options.precision));
		}
	} else {
		if (propertyIndexToChange <= 3) {
			widget.value = Math.round(processedValue);
		} else {
			widget.value = processedValue;
		}
	}

	if (node.properties && node.properties["values"] &&
		selectedAreaIndex >= 0 && selectedAreaIndex < node.properties["values"].length &&
		node.properties["values"][selectedAreaIndex]) {
		if (propertyIndexToChange >= 0 && propertyIndexToChange < node.properties["values"][selectedAreaIndex].length) {
			node.properties["values"][selectedAreaIndex][propertyIndexToChange] = widget.value;
		} else {
			console.error(`[transformFunc] propertyIndexToChange (${propertyIndexToChange}) out of bounds for values[${selectedAreaIndex}] (len: ${node.properties["values"][selectedAreaIndex].length}).`);
		}
	} else {
		console.error(`[transformFunc] Cannot access values[${selectedAreaIndex}] (values len: ${node.properties["values"] ? node.properties["values"].length : 'N/A'}).`);
	}

	if (node.setDirtyCanvas) {
		node.setDirtyCanvas(true, true);
	}
}

export function swapInputs(node, indexA, indexB) {
	const linkA = node.inputs[indexA].link
	let origin_slotA = null
	let node_IDA = null
	let connectedNodeA = null
	let labelA = node.inputs[indexA].label || null

	const linkB = node.inputs[indexB].link
	let origin_slotB = null
	let node_IDB = null
	let connectedNodeB = null
	let labelB = node.inputs[indexB].label || null

	if (linkA) {
		node_IDA = node.graph.links[linkA].origin_id
		origin_slotA = node.graph.links[linkA].origin_slot
		connectedNodeA = node.graph._nodes_by_id[node_IDA]

		node.disconnectInput(indexA)
	}

	if (linkB) {
		node_IDB = node.graph.links[linkB].origin_id
		origin_slotB = node.graph.links[linkB].origin_slot
		connectedNodeB = node.graph._nodes_by_id[node_IDB]

		node.disconnectInput(indexB)
	}

	if (linkA) {
		connectedNodeA.connect(origin_slotA, node, indexB)
	}

	if (linkB) {
		connectedNodeB.connect(origin_slotB, node, indexA)
	}

	node.inputs[indexA].label = labelB
	node.inputs[indexB].label = labelA
	
}

export function renameNodeInputs(node, name, offset=0) {
	for (let i=offset; i < node.inputs.length; i++) {
		node.inputs[i].name = `${name}${i-offset}`
	}
}

export function removeNodeInputs(node, indexesToRemove, offset=0) {
	indexesToRemove.sort((a, b) => b - a);

	for (let i of indexesToRemove) {
		node.removeInput(i)
		if (node.properties && node.properties.values) {
			node.properties.values.splice(i-offset, 1)
		}
	}

	const inputLenght = node.properties["values"].length-1

	node.widgets[node.index].options.max = inputLenght
	if (node.widgets[node.index].value > inputLenght) {
		node.widgets[node.index].value = inputLenght
	}

	node.onResize(node.size)
}

export function getDrawColor(percent, alpha) {
	let h = 360*percent
	let s = 50;
	let l = 50;
	l /= 100;
	const a = s * Math.min(l, 1 - l) / 100;
	const f = n => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
	};
	return `#${f(0)}${f(8)}${f(4)}${alpha}`;
}