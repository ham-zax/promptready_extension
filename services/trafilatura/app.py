from __future__ import annotations

import time
from typing import Optional

import httpx
import trafilatura
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


class ExtractRequest(BaseModel):
    url: Optional[str] = None
    html: Optional[str] = None
    output: str = Field(default="markdown", pattern="^(markdown|text)$")
    includeMetadata: bool = True
    title: Optional[str] = None


class ExtractResponse(BaseModel):
    success: bool
    markdown: str
    metadata: dict
    warnings: list[str]
    diagnostics: dict


app = FastAPI(title="PromptReady Trafilatura Service", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "trafilatura", "version": "0.1.0"}


def _download_html(url: str) -> str:
    with httpx.Client(timeout=10.0, follow_redirects=True) as client:
        resp = client.get(url, headers={"User-Agent": "PromptReadyTrafilatura/0.1"})
        resp.raise_for_status()
        return resp.text


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest) -> ExtractResponse:
    if not req.html and not req.url:
        raise HTTPException(status_code=400, detail="Either html or url is required")

    start = time.time()
    warnings: list[str] = []

    html = req.html
    if not html and req.url:
        try:
            html = _download_html(req.url)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}") from exc

    if not html:
        raise HTTPException(status_code=400, detail="No HTML available for extraction")

    extracted = trafilatura.extract(
        html,
        output_format="markdown" if req.output == "markdown" else "txt",
        include_comments=False,
        include_tables=True,
        include_images=True,
        favor_precision=True,
        with_metadata=req.includeMetadata,
    )

    if not extracted:
        warnings.append("trafilatura returned empty extraction")
        extracted = ""

    elapsed_ms = int((time.time() - start) * 1000)
    metadata = {
        "title": req.title or "",
        "url": req.url or "",
    }

    return ExtractResponse(
        success=True,
        markdown=extracted,
        metadata=metadata,
        warnings=warnings,
        diagnostics={
            "provider": "trafilatura",
            "elapsedMs": elapsed_ms,
        },
    )
