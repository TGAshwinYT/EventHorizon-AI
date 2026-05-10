import os
import re

source_dir = r"d:\Library\Ashwin\Offical\TamilGaming\AI\frontend\src\components"
dest_dir = r"d:\Library\Ashwin\Offical\TamilGaming\AI\frontend\src\mobile\components"

files_to_copy = [
    "MarketDashboard.tsx",
    "SkillsDashboard.tsx",
    "VisualScanner.tsx",
    "Settings.tsx"
]

os.makedirs(dest_dir, exist_ok=True)

def process_file(filename):
    with open(os.path.join(source_dir, filename), 'r', encoding='utf-8') as f:
        content = f.read()

    # Update relative imports to point back to src/components
    content = re.sub(r"from '\./([^']+)'", r"from '../../components/\1'", content)

    # Change container classes for mobile
    content = content.replace("h-[85vh]", "h-full")
    content = content.replace("h-[80vh]", "h-full")
    content = content.replace("max-w-6xl mx-auto", "w-full")
    content = content.replace("max-w-4xl mx-auto my-auto", "w-full pt-4")
    
    # VisualScanner specific fixes for mobile full screen
    content = content.replace("min-h-[72px]", "min-h-[64px]")
    
    # Settings layout fix (make it stack vertically on mobile instead of flex-row sidebar)
    if filename == "Settings.tsx":
        content = content.replace('className="flex flex-1 overflow-hidden"', 'className="flex flex-col flex-1 overflow-hidden"')
        content = content.replace('w-64 border-r border-white/10 pr-4 space-y-2', 'w-full border-b border-white/10 pb-4 mb-4 flex overflow-x-auto gap-2')
        content = content.replace('w-full flex items-center', 'whitespace-nowrap flex items-center')
        content = content.replace('pl-8', 'px-2')

    # Rename export and function
    base_name = filename.split('.')[0]
    mobile_name = f"Mobile{base_name}"
    content = content.replace(f"const {base_name} =", f"const {mobile_name} =")
    content = content.replace(f"export default {base_name};", f"export default {mobile_name};")

    with open(os.path.join(dest_dir, f"{mobile_name}.tsx"), 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Processed {filename} -> {mobile_name}.tsx")

for f in files_to_copy:
    process_file(f)
