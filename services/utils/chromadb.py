from __future__ import annotations

from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions


DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"
DEFAULT_COLLECTION_NAME = "huntflow_collection"
DEFAULT_PERSIST_DIR = "./chroma_db"


def get_chroma_client(
    persist_directory: str = DEFAULT_PERSIST_DIR,
    allow_reset: bool = False,
) -> chromadb.Client:
    """
    Create and return a persistent Chroma client.
    """
    return chromadb.PersistentClient(
        path=persist_directory,
        settings=Settings(
            allow_reset=allow_reset,
            anonymized_telemetry=False,
        ),
    )


def get_embedding_function(
    model_name: str = DEFAULT_EMBEDDING_MODEL,
):
    """
    Create the embedding function used by Chroma.
    """
    return embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=model_name
    )


def get_or_create_collection(
    collection_name: str = DEFAULT_COLLECTION_NAME,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
    metadata: Optional[Dict[str, Any]] = None,
):
    """
    Get or create a Chroma collection.
    """
    client = get_chroma_client(persist_directory=persist_directory)
    embedding_function = get_embedding_function(model_name=embedding_model)

    return client.get_or_create_collection(
        name=collection_name,
        embedding_function=embedding_function,
        metadata=metadata,
    )


def add_documents(
    collection_name: str,
    documents: List[str],
    ids: List[str],
    metadatas: Optional[List[Dict[str, Any]]] = None,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> Dict[str, Any]:
    """
    Add documents to a collection.
    """
    if not documents:
        raise ValueError("documents cannot be empty")

    if not ids:
        raise ValueError("ids cannot be empty")

    if len(documents) != len(ids):
        raise ValueError("documents and ids must have the same length")

    if metadatas is not None and len(metadatas) != len(documents):
        raise ValueError("metadatas must have the same length as documents")

    collection = get_or_create_collection(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_model=embedding_model,
    )

    collection.add(
        documents=documents,
        ids=ids,
        metadatas=metadatas,
    )

    return {
        "success": True,
        "collection": collection_name,
        "count": len(documents),
    }


def query_documents(
    collection_name: str,
    query_texts: List[str],
    n_results: int = 5,
    where: Optional[Dict[str, Any]] = None,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> Dict[str, Any]:
    """
    Query similar documents from a collection.
    """
    if not query_texts:
        raise ValueError("query_texts cannot be empty")

    collection = get_or_create_collection(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_model=embedding_model,
    )

    results = collection.query(
        query_texts=query_texts,
        n_results=n_results,
        where=where,
    )

    return results


def get_documents(
    collection_name: str,
    ids: Optional[List[str]] = None,
    limit: Optional[int] = None,
    where: Optional[Dict[str, Any]] = None,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> Dict[str, Any]:
    """
    Get documents from a collection.
    """
    collection = get_or_create_collection(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_model=embedding_model,
    )

    kwargs: Dict[str, Any] = {}

    if ids is not None:
        kwargs["ids"] = ids
    if limit is not None:
        kwargs["limit"] = limit
    if where is not None:
        kwargs["where"] = where

    return collection.get(**kwargs)


def update_documents(
    collection_name: str,
    ids: List[str],
    documents: Optional[List[str]] = None,
    metadatas: Optional[List[Dict[str, Any]]] = None,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> Dict[str, Any]:
    """
    Update existing documents in a collection.
    """
    if not ids:
        raise ValueError("ids cannot be empty")

    collection = get_or_create_collection(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_model=embedding_model,
    )

    collection.update(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
    )

    return {
        "success": True,
        "collection": collection_name,
        "updated_count": len(ids),
    }


def delete_documents(
    collection_name: str,
    ids: Optional[List[str]] = None,
    where: Optional[Dict[str, Any]] = None,
    persist_directory: str = DEFAULT_PERSIST_DIR,
    embedding_model: str = DEFAULT_EMBEDDING_MODEL,
) -> Dict[str, Any]:
    """
    Delete documents from a collection by ids or filter.
    """
    if ids is None and where is None:
        raise ValueError("provide either ids or where")

    collection = get_or_create_collection(
        collection_name=collection_name,
        persist_directory=persist_directory,
        embedding_model=embedding_model,
    )

    collection.delete(ids=ids, where=where)

    return {
        "success": True,
        "collection": collection_name,
    }


def delete_collection(
    collection_name: str,
    persist_directory: str = DEFAULT_PERSIST_DIR,
) -> Dict[str, Any]:
    """
    Delete a whole Chroma collection.
    """
    client = get_chroma_client(persist_directory=persist_directory)
    client.delete_collection(name=collection_name)

    return {
        "success": True,
        "deleted_collection": collection_name,
    }