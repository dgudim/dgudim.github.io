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
base = 'parts/base.html.j2'

files = pathlib.Path(root);

for [dirpath, dirnames, filenames] in os.walk(root):
    
    base_tamplate = env.get_template(base);
    
    for item in filenames:
        fullitem = os.path.join(dirpath, item);
    
        if os.path.isfile(fullitem) and item.endswith('.j2'):
            print(f"Rendering {item}");
            with open(os.path.join(rendered, item).replace('.j2', ''), "w") as fh:
                template = env.get_template(item);
                ctx = template.new_context();
                content = env.concat(template.root_render_func(ctx));
                title = ctx.vars.get('title', None);
                base_tamplate.stream(content = content, title = title).dump(fh);
    break; # Only parse top level
  