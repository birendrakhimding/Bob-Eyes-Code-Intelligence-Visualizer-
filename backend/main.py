from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from api import router

load_dotenv()

app = FastAPI(title="Code Intelligence Visualizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bob-eyes-code-intelligence-visualiz.vercel.app",
        "https://bob-eyes-code-intelligence-visualizer-5dz94prqz.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Made with Bob
