"""Pydantic request/response models."""
from pydantic import BaseModel
from typing import Optional, Any


class LoginRequest(BaseModel):
    email: str
    password: str


class KeyLoginRequest(BaseModel):
    accessKeyId: str
    secretAccessKey: str


class RegisterRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    email: str


class RunStatus(BaseModel):
    runId: str
    caseId: str
    status: str
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    stages: dict = {}
    s3_path: Optional[str] = None
    error: Optional[str] = None


class TriggerRequest(BaseModel):
    caseId: str
    stage: str = "FULL_PIPELINE"
