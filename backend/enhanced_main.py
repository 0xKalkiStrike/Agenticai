from fastapi import FastAPI, APIRouter, Depends, HTTPException
import json
import os
from pydantic import BaseModel
from typing import List, Optional

# Import necessary dependencies
from enhanced_rbac_main import get_user, admin_required

app = FastAPI()

# 1. Create an APIRouter instance
# We can define a prefix, tags, and common dependencies for all routes in this router.
router = APIRouter(
    prefix="/admin/knowledge",
    tags=["Knowledge Base"],
    dependencies=[Depends(admin_required)]
)

class KnowledgeEntry(BaseModel):
    keywords: List[str]
    answer: str
    category: str

class KnowledgeUpdate(BaseModel):
    keywords: Optional[List[str]] = None
    answer: Optional[str] = None
    category: Optional[str] = None

# The path to your knowledge base file
KNOWLEDGE_BASE_PATH = "../../backend/data/knowledge_base_large.json"
if not os.path.exists(KNOWLEDGE_BASE_PATH):
    KNOWLEDGE_BASE_PATH = "../../backend/data/knowledge_base.json"

# 2. Use the router to define routes
@router.get("/")
# No need for @admin_required here, it's applied to the whole router
def get_knowledge_base(current_user: dict = Depends(get_user)):
    """
    An admin-only endpoint to view the entire knowledge base.
    """
    if not os.path.exists(KNOWLEDGE_BASE_PATH):
        raise HTTPException(status_code=404, detail=f"Knowledge base file not found at {KNOWLEDGE_BASE_PATH}")
    try:
        with open(KNOWLEDGE_BASE_PATH, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.post("/")
def add_knowledge(data: KnowledgeEntry, current_user: dict = Depends(get_user)):
    """Add a new entry to the knowledge base"""
    if not os.path.exists(KNOWLEDGE_BASE_PATH):
        raise HTTPException(status_code=404, detail=f"Knowledge base file not found at {KNOWLEDGE_BASE_PATH}")

    try:
        with open(KNOWLEDGE_BASE_PATH, 'r+') as f:
            file_data = json.load(f)
            
            # Generate ID
            new_id = 1
            if file_data and isinstance(file_data, list):
                ids = [e.get("id", 0) for e in file_data if isinstance(e, dict)]
                if ids:
                    new_id = max(ids) + 1
            
            entry = data.dict()
            entry["id"] = new_id
            
            file_data.append(entry)
            
            f.seek(0)
            json.dump(file_data, f, indent=2)
            f.truncate()
            
        return {"status": "success", "entry": entry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.put("/{entry_id}")
def update_knowledge_entry(entry_id: int, update_data: KnowledgeUpdate, current_user: dict = Depends(get_user)):
    """
    Updates a specific entry in the knowledge base.
    """
    if not os.path.exists(KNOWLEDGE_BASE_PATH):
        raise HTTPException(status_code=404, detail=f"Knowledge base file not found at {KNOWLEDGE_BASE_PATH}")

    try:
        with open(KNOWLEDGE_BASE_PATH, 'r+') as f:
            data = json.load(f)
            
            entry_found = False
            for i, entry in enumerate(data):
                # The generated data has 'id', but the static data might not.
                if entry.get("id") == entry_id:
                    # Get the provided update data, excluding unset fields
                    update_payload = update_data.dict(exclude_unset=True)
                    # Update the entry with the new data
                    data[i].update(update_payload)
                    entry_found = True
                    break
            
            if not entry_found:
                raise HTTPException(status_code=404, detail=f"Entry with id {entry_id} not found.")

            # Go back to the beginning of the file to overwrite it
            f.seek(0)
            json.dump(data, f, indent=2)
            f.truncate()
        return {"status": "success", "message": f"Entry {entry_id} updated."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

app.include_router(router)
