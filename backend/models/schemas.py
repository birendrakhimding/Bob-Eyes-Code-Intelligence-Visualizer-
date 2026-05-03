from pydantic import BaseModel


class ParseRequest(BaseModel):
    code: str
    language: str = "auto"


class ImpactRequest(BaseModel):
    old_code: str
    new_code: str
    language: str = "auto"

# Made with Bob
