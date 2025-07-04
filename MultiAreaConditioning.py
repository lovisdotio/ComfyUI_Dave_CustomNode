# Made by Davemane42#0042 for ComfyUI
# 02/04/2023

import torch
from nodes import MAX_RESOLUTION

class MultiAreaConditioning:
    def __init__(self) -> None:
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "conditioning0": ("CONDITIONING", ),
                "conditioning1": ("CONDITIONING", )
            },
            "hidden": {"extra_pnginfo": "EXTRA_PNGINFO", "unique_id": "UNIQUE_ID"},
        }
    


    RETURN_TYPES = ("CONDITIONING", "INT", "INT")
    RETURN_NAMES = (None, "resolutionX", "resolutionY")
    FUNCTION = "doStuff"
    CATEGORY = "Davemane42"

    def doStuff(self, extra_pnginfo, unique_id, **kwargs):
        c = []
        values = []
        resolutionX = 512
        resolutionY = 512

        # Robustly extract properties from extra_pnginfo
        node_properties = None
        if extra_pnginfo and "workflow" in extra_pnginfo and "nodes" in extra_pnginfo["workflow"]:
            for node_info in extra_pnginfo["workflow"]["nodes"]:
                # Ensure IDs are compared consistently (e.g., as strings)
                if str(node_info.get("id", "")) == str(unique_id):
                    node_properties = node_info.get("properties", {})
                    break
        
        if node_properties is not None:
            values = node_properties.get("values", [])
            resolutionX = node_properties.get("width", 512)
            resolutionY = node_properties.get("height", 512)
        else:
            print(f"[MultiAreaConditioning] Warning: Could not find properties for node unique_id {unique_id}. Using default values.")
            # values remains [], resolutionX/Y are defaults

        for i in range(len(kwargs)): # Iterate up to the number of conditioning inputs received
            arg_name = f"conditioning{i}"
            
            if arg_name not in kwargs:
                # This case should ideally not happen if kwargs are sequentially named
                # and JS ensures values/inputs are in sync.
                # If it does, it means there's a gap in conditioning inputs.
                # We might have a values[i] but no kwargs[arg_name].
                # For safety, we check if 'i' is within bounds of 'values'.
                if i < len(values):
                    print(f"[MultiAreaConditioning] Warning: Missing {arg_name} in inputs, but found params in values[{i}]. Skipping this area.")
                continue

            # Check if we have parameters for this conditioning input index
            if i >= len(values):
                # More conditioning inputs in kwargs than parameter sets in 'values'
                # This could happen if JS failed to add a value set when an input was added.
                print(f"[MultiAreaConditioning] Warning: No parameters in 'values' for {arg_name} (index {i}). Skipping this area.")
                continue

            current_conditioning_data = kwargs[arg_name]

            # Check if the conditioning data itself is valid (e.g., a tensor)
            # Each conditioning is a list of [tensor, dict_with_pooled_output]
            if not current_conditioning_data or not isinstance(current_conditioning_data, list) or not current_conditioning_data[0] or not torch.is_tensor(current_conditioning_data[0][0]):
                print(f"[MultiAreaConditioning] Info: {arg_name} (index {i}) is not a valid tensor or is empty. Skipping.")
                continue
            
            val_set = values[i]
            # Ensure val_set has the expected number of elements (x, y, w, h, strength)
            if not isinstance(val_set, list) or len(val_set) < 5:
                print(f"[MultiAreaConditioning] Warning: Parameters for {arg_name} (values[{i}]) are malformed. Expected [x,y,w,h,strength]. Got: {val_set}. Skipping.")
                continue

            x, y = val_set[0], val_set[1]
            w, h = val_set[2], val_set[3]
            strength = val_set[4] # strength is at index 4

            # If fullscreen (area covers the entire resolution)
            if (x == 0 and y == 0 and w == resolutionX and h == resolutionY):
                for t in current_conditioning_data:
                    # Ensure 't' is a list/tuple of [tensor, dict]
                    if isinstance(t, (list, tuple)) and len(t) == 2:
                        # Create a new copy of the conditioning item to avoid modifying the original
                        # if it's shared or comes from a cache.
                        c_item = [t[0], t[1].copy()]
                        # Ensure 'area' is removed for fullscreen, or set appropriately if that's the convention
                        # ComfyUI typically omits 'area' for fullscreen conditionings.
                        if 'area' in c_item[1]:
                            del c_item[1]['area'] 
                        # Overwrite strength if it exists, or add it.
                        c_item[1]['strength'] = strength 
                        c.append(c_item)
                    else:
                        print(f"[MultiAreaConditioning] Warning: Malformed conditioning item in {arg_name} for fullscreen: {t}")

                continue # Continue to the next conditioning input in kwargs
            
            # Adjust width/height if they exceed boundaries
            if x + w > resolutionX:
                w = max(0, resolutionX - x)
            if y + h > resolutionY:
                h = max(0, resolutionY - y)

            if w == 0 or h == 0: # Skip if area is zero-sized after adjustment
                print(f"[MultiAreaConditioning] Info: Area for {arg_name} (values[{i}]) became zero-sized after boundary adjustment. Skipping.")
                continue

            for t in current_conditioning_data:
                if isinstance(t, (list, tuple)) and len(t) == 2:
                    n = [t[0], t[1].copy()] # Work on a copy of the conditioning's dictionary part
                    # Area is (height, width, y, x) all in multiples of 8 (latent space)
                    n[1]['area'] = (h // 8, w // 8, y // 8, x // 8)
                    n[1]['strength'] = strength
                    # These min/max_sigma might be specific to certain samplers or use cases.
                    # If they are always fixed, this is fine.
                    n[1]['min_sigma'] = 0.0 
                    n[1]['max_sigma'] = 99.0
                    c.append(n)
                else:
                    print(f"[MultiAreaConditioning] Warning: Malformed conditioning item in {arg_name} for area processing: {t}")
            
        return (c, resolutionX, resolutionY)

class ConditioningUpscale():
    def __init__(self) -> None:
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "conditioning": ("CONDITIONING", ),
                "scalar": ("INT", {"default": 2, "min": 1, "max": 100, "step": 0.5}),
            },
        }
    
    RETURN_TYPES = ("CONDITIONING",)
    CATEGORY = "Davemane42"

    FUNCTION = 'upscale'

    def upscale(self, conditioning, scalar):
        c = []
        for t in conditioning:

            n = [t[0], t[1].copy()]
            if 'area' in n[1]:
                
                n[1]['area'] = tuple(map(lambda x: ((x*scalar + 7) >> 3) << 3, n[1]['area']))

            c.append(n)

        return (c, )
    
class ConditioningStretch():
    def __init__(self) -> None:
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "conditioning": ("CONDITIONING", ),
                "resolutionX": ("INT", {"default": 512, "min": 64, "max": MAX_RESOLUTION, "step": 64}),
                "resolutionY": ("INT", {"default": 512, "min": 64, "max": MAX_RESOLUTION, "step": 64}),
                "newWidth": ("INT", {"default": 512, "min": 64, "max": MAX_RESOLUTION, "step": 64}),
                "newHeight": ("INT", {"default": 512, "min": 64, "max": MAX_RESOLUTION, "step": 64}),
                #"scalar": ("INT", {"default": 2, "min": 1, "max": 100, "step": 0.5}),
            },
        }
    
    RETURN_TYPES = ("CONDITIONING",)
    CATEGORY = "Davemane42"

    FUNCTION = 'upscale'

    def upscale(self, conditioning, resolutionX, resolutionY, newWidth, newHeight, scalar=1):
        c = []
        for t in conditioning:

            n = [t[0], t[1].copy()]
            if 'area' in n[1]:

                newWidth *= scalar
                newHeight *= scalar
                
                #n[1]['area'] = tuple(map(lambda x: ((x*scalar + 32) >> 6) << 6, n[1]['area']))
                x = ((n[1]['area'][3]*8)*newWidth/resolutionX) // 8
                y = ((n[1]['area'][2]*8)*newHeight/resolutionY) // 8
                w = ((n[1]['area'][1]*8)*newWidth/resolutionX) // 8
                h = ((n[1]['area'][0]*8)*newHeight/resolutionY) // 8

                n[1]['area'] = tuple(map(lambda x: (((int(x) + 7) >> 3) << 3), [h, w, y, x]))

            c.append(n)

        return (c, )

class ConditioningDebug():
    def __init__(self) -> None:
        pass

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "conditioning": ("CONDITIONING", ),
            }
        }
    
    RETURN_TYPES = ()
    FUNCTION = "debug"

    OUTPUT_NODE = True

    CATEGORY = "Davemane42"

    def debug(self, conditioning):
        print("\nDebug")
        for i, t in enumerate(conditioning):
            print(f"{i}:")
            if "area" in t[1]:
                print(f"\tx{t[1]['area'][3]*8} y{t[1]['area'][2]*8} \n\tw{t[1]['area'][1]*8} h{t[1]['area'][0]*8} \n\tstrength: {t[1]['strength']}")
            else:
                print(f"\tFullscreen")

        return (None, )