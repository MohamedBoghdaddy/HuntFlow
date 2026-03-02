import chromadb
from chromadb.utils import embedding_functions

# Create collection
client = chromadb.Client()
collection = client.create_collection(
    name="jobs",
    embedding_function=embedding_functions.GooglePalmEmbeddingFunction(api_key=os.getenv("GEMINI_API_KEY"))
)

# Add job embeddings
collection.add(
    documents=[job.description for job in jobs],
    metadatas=[{"title": job.title, "company": job.company, ...}],
    ids=[str(job.id) for job in jobs]
)

# Query with CV text
results = collection.query(query_texts=[cv_text], n_results=5)