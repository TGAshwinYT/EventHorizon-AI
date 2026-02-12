import hashlib

# The filename found was "John Deere 5310 utility tractor, rear.jpg"
# Wikimedia URLs replace spaces with underscores.
filename = "John_Deere_5310_utility_tractor,_rear.jpg"

base_url = "https://upload.wikimedia.org/wikipedia/commons"

m: str = hashlib.md5(filename.encode('utf-8')).hexdigest()
path = f"{base_url}/{m[0]}/{m[0]}{m[1]}/{filename}"
print(f"URL: {path}")
with open("jd_url.txt", "w") as f:
    f.write(path)
