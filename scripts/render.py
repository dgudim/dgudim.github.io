from jinja2 import Environment, FileSystemLoader, BaseLoader
import pathlib, os

def mkdir(path):
    if not os.path.exists(path):
        os.mkdir(path);

root = os.path.abspath(os.path.join(os.path.dirname(os.path.realpath(__file__)), ".."));

rendered = os.path.join(root, 'rendered');
mkdir(rendered);
print(root);

env = Environment(loader=FileSystemLoader(root))

files = pathlib.Path(root);

for [dirpath, dirnames, filenames] in os.walk(root):
    for item in filenames:
        fullitem = os.path.join(dirpath, item);
    
        if os.path.isfile(fullitem) and item.endswith('.j2'):
            print(f"Rendering {item}");
            with open(os.path.join(rendered, item).replace('.j2', ''), "w") as fh:
                env.get_template(item).stream().dump(fh);
    break; # Only parse top level
  