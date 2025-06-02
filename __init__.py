# Made by Davemane42#0042 for ComfyUI
import os
import subprocess
import importlib.util
import sys
import filecmp
import shutil

import __main__

python = sys.executable

print("[Davemane42 Node DEBUG] __init__.py started")
print(f"[Davemane42 Node DEBUG] __main__.__file__: {os.path.realpath(__main__.__file__)}")
print(f"[Davemane42 Node DEBUG] Custom node __file__: {os.path.realpath(__file__)}")

extentions_folder = os.path.join(os.path.dirname(os.path.realpath(__main__.__file__)),
                                 "web" + os.sep + "extensions" + os.sep + "Davemane42")
javascript_folder = os.path.join(os.path.dirname(os.path.realpath(__file__)), "javascript")

print(f"[Davemane42 Node DEBUG] Calculated javascript_folder: {javascript_folder}")
print(f"[Davemane42 Node DEBUG] Calculated extentions_folder (target for JS): {extentions_folder}")

if not os.path.exists(extentions_folder):
    print(f'[Davemane42 Node DEBUG] Target extensions folder {extentions_folder} does not exist. Creating it.')
    try:
        os.makedirs(extentions_folder, exist_ok=True) # Use makedirs with exist_ok=True for safety
        print(f'[Davemane42 Node DEBUG] Successfully created or ensured existence of {extentions_folder}')
    except Exception as e:
        print(f'[Davemane42 Node DEBUG] Error creating folder {extentions_folder}: {e}')
else:
    print(f'[Davemane42 Node DEBUG] Target extensions folder {extentions_folder} already exists.')

if not os.path.exists(javascript_folder):
    print(f'[Davemane42 Node DEBUG] CRITICAL: Source javascript folder {javascript_folder} does not exist!')
else:
    print(f'[Davemane42 Node DEBUG] Source javascript folder {javascript_folder} exists.')
    print(f"[Davemane42 Node DEBUG] Contents of source javascript folder ({javascript_folder}): {os.listdir(javascript_folder)}")

try:
    result = filecmp.dircmp(javascript_folder, extentions_folder)
    print(f"[Davemane42 Node DEBUG] filecmp.dircmp result - left_only: {result.left_only}, right_only: {result.right_only}, diff_files: {result.diff_files}")

    files_to_copy = []
    if result.left_only:
        files_to_copy.extend(result.left_only)
        print(f"[Davemane42 Node DEBUG] Files in source not in destination: {result.left_only}")
    if result.diff_files:
        # Ensure not to add duplicates if already in left_only (though dircmp structure usually prevents this)
        for f in result.diff_files:
            if f not in files_to_copy:
                files_to_copy.append(f)
        print(f"[Davemane42 Node DEBUG] Files differing or in source and destination but different: {result.diff_files}")

    if not files_to_copy:
        print("[Davemane42 Node DEBUG] No new or modified JavaScript files to copy.")
    else:
        print(f'[Davemane42 Node DEBUG] Update to javascripts files detected. Files to copy: {files_to_copy}')
        for file in files_to_copy:
            src_file = os.path.join(javascript_folder, file)
            dst_file = os.path.join(extentions_folder, file)
            print(f'[Davemane42 Node DEBUG] Attempting to copy {src_file} to {dst_file}')
            try:
                if os.path.exists(dst_file):
                    print(f'[Davemane42 Node DEBUG] Destination file {dst_file} exists, removing it first.')
                    os.remove(dst_file)
                shutil.copy2(src_file, dst_file) # Use copy2 to preserve metadata, might be useful
                print(f'[Davemane42 Node DEBUG] Successfully copied {file} to extensions folder.')
            except Exception as e:
                print(f'[Davemane42 Node DEBUG] Error copying file {file}: {e}')

except Exception as e:
    print(f"[Davemane42 Node DEBUG] Error during file comparison or copying process: {e}")


def is_installed(package, package_overwrite=None):
    try:
        spec = importlib.util.find_spec(package)
    except ModuleNotFoundError:
        pass

    package = package_overwrite or package

    if spec is None:
        print(f"Installing {package}...")
        command = f'"{python}" -m pip install {package}'
  
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, env=os.environ)

        if result.returncode != 0:
            print(f"Couldn't install\nCommand: {command}\nError code: {result.returncode}")

# is_installed("huggingface_hub")
# is_installed("onnx")
# is_installed("onnxruntime", "onnxruntime-gpu")

from .MultiAreaConditioning import MultiAreaConditioning, ConditioningUpscale, ConditioningStretch, ConditioningDebug
from .MultiLatentComposite import MultiLatentComposite
#from .ABGRemover import ABGRemover

NODE_CLASS_MAPPINGS = {
    "MultiLatentComposite": MultiLatentComposite,
    "MultiAreaConditioning": MultiAreaConditioning,
    "ConditioningUpscale": ConditioningUpscale,
    "ConditioningStretch": ConditioningStretch,
    "ConditioningDebug": ConditioningDebug,
    #"ABGRemover": ABGRemover,
}

print('\033[34mDavemane42 Custom Nodes: \033[92mLoaded\033[0m')