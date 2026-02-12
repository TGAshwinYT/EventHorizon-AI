import hashlib

files = [
    "John_Deere_5055E_tractor.JPG",
    "Mahindra_tractor.JPG",
    "Sonalika_DI_tractor.jpg",
    "Tata_Ace_Mini_Truck_(1).JPG",
    "Kubota_tractor_9.jpg"
]

base_url = "https://upload.wikimedia.org/wikipedia/commons"

for f in files:
    # Wikimedia uses underscores for spaces.
    # The hash is calculated on the filename *with* spaces replaced by underscores? 
    # Actually, the file title on the page has spaces, the URL has underscores. 
    # The hash is on the *underscore* version.
    
    # MD5 of the filename string
    m: str = hashlib.md5(f.encode('utf-8')).hexdigest()
    # Pylance/Pyre might complain about slicing on inferred types, casting explicit
    m_str = str(m)
    # Using concatenation instead of slicing to avoid linter slicing error
    path = f"{base_url}/{m_str[0]}/{m_str[0] + m_str[1]}/{f}"
    print(f"{f}: {path}")
    with open("wiki_urls.txt", "a") as out:
        out.write(f"{f}: {path}\n")
