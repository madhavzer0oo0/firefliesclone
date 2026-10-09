from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from fastapi.responses import JSONResponse
from .api import router
from .config import settings
from .database import get_db
from .models import Meeting
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

app = FastAPI(title='Fireflies Clone API', version='0.1.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allow_headers=['Content-Type'],
)
app.include_router(router)


@app.exception_handler(IntegrityError)
async def integrity_error(_request, _error):
    return JSONResponse(status_code=409, content={'detail': 'Conflicting data or database relationship'})


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/ready')
def readiness(db: Session = Depends(get_db)):
    try:
        db.execute(select(Meeting.id).limit(1))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return {'status': 'ready'}
