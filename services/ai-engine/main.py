"""
SchoolOS AI Engine - LM Studio integration with fallback mock.
"""
import os
import json
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

LM_STUDIO_URL = os.getenv("LM_STUDIO_URL", "http://localhost:1234/v1").rstrip("/")
LM_STUDIO_MODEL = os.getenv("LM_STUDIO_MODEL", "local-model")
LM_STUDIO_KEY = os.getenv("LM_STUDIO_KEY", "lm-studio")

app = FastAPI(title="SchoolOS AI Engine", version="1.0.0")


async def chat(prompt: str, system: Optional[str] = None) -> str:
    if not LM_STUDIO_URL:
        return ""
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{LM_STUDIO_URL}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {LM_STUDIO_KEY}",
                },
                json={
                    "model": LM_STUDIO_MODEL,
                    "messages": messages,
                    "max_tokens": 500,
                    "temperature": 0.7,
                },
            )
            r.raise_for_status()
            data = r.json()
            return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
    except Exception as e:
        print(f"LM Studio request failed: {e}")
        return ""


# --- Request/Response models ---

class CareerProfile(BaseModel):
    favorite_subjects: list[str] = []
    hobbies: list[str] = []
    liked_activities: list[str] = []
    disliked_activities: list[str] = []
    student_name: Optional[str] = None
    grade: Optional[int] = None


class ResponseItem(BaseModel):
    question_id: str
    answer: str
    category: Optional[str] = None
    question_text: Optional[str] = None


class AssessmentQuestionResponse(BaseModel):
    question: str
    options: list[str] = ["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"]


class CareerRecommendationsResponse(BaseModel):
    top_careers: list[str]
    alternate_careers: list[str]
    stream_recommendation: str
    summary: Optional[str] = None


class LearningInsightsResponse(BaseModel):
    insights: str


# --- Endpoints ---

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-engine"}


class GenerateQuestionRequest(BaseModel):
    category: str
    profile: CareerProfile


@app.post("/generate-assessment-question", response_model=AssessmentQuestionResponse)
async def generate_assessment_question(body: GenerateQuestionRequest):
    category = body.category
    profile = body.profile
    prompt = (
        f"Generate exactly one short multiple-choice question for a career assessment. "
        f"Category: {category}. "
        f"Student likes: {', '.join(profile.favorite_subjects)}. Hobbies: {', '.join(profile.hobbies)}. "
        f"Return only the question text, one line, no numbering."
    )
    system = "You are a career counselor. Output only the question, one line."
    text = await chat(prompt, system)
    if text:
        question = text.lstrip("0123456789.").strip()
    else:
        fallbacks = {
            "interest": "Do you enjoy solving logical problems and building things?",
            "personality": "Would you enjoy leading a team on a project?",
            "aptitude": "Do you find it easy to learn new software or tools?",
        }
        question = fallbacks.get(category, "Do you prefer working with people or with data?")
    return AssessmentQuestionResponse(
        question=question,
        options=["Strongly Agree", "Agree", "Neutral", "Disagree", "Strongly Disagree"],
    )


class AnalyzeRequest(BaseModel):
    profile: CareerProfile
    responses: list[ResponseItem] = []


@app.post("/analyze-assessment-responses")
async def analyze_assessment_responses(body: AnalyzeRequest):
    profile = body.profile
    responses = body.responses
    return {
        "interest_profile": "Analytical and technical interests",
        "personality_indicators": ["Structured", "Goal-oriented"],
        "aptitude_indicators": ["Logical reasoning", "Problem-solving"],
    }


class CareerRecRequest(BaseModel):
    profile: CareerProfile
    responses: list[ResponseItem] = []


@app.post("/career-recommendations", response_model=CareerRecommendationsResponse)
async def career_recommendations(body: CareerRecRequest):
    profile = body.profile
    responses = body.responses
    prompt = (
        f"Based on favorite subjects {', '.join(profile.favorite_subjects)} and hobbies {', '.join(profile.hobbies)}, "
        f"and {len(responses)} assessment answers, suggest 5 top careers and 3 alternate careers. "
        f'Format: "TOP: career1, career2, ... ALT: career1, career2, career3" then a short summary.'
    )
    text = await chat(prompt)
    top = ["Software Engineer", "AI/ML Engineer", "Data Analyst", "Robotics Engineer", "Product Manager"]
    alt = ["Technical Writer", "EdTech Specialist", "Research Scientist"]
    stream = "MPC"
    summary = "CareerBuddy assessment complete. Consider exploring STEM and technology streams."
    if text:
        if "TOP:" in text:
            part = text.split("TOP:")[1].split("ALT:")[0] if "ALT:" in text else text.split("TOP:")[1]
            top = [x.strip() for x in part.replace("\n", ",").split(",") if x.strip()][:5]
        if "ALT:" in text:
            part = text.split("ALT:")[1]
            alt = [x.strip() for x in part.replace("\n", ",").split(",") if x.strip()][:3]
    return CareerRecommendationsResponse(
        top_careers=top,
        alternate_careers=alt,
        stream_recommendation=stream,
        summary=summary,
    )


class LearningInsightsRequest(BaseModel):
    student_id: str
    grades_json: Optional[str] = None


@app.post("/learning-insights", response_model=LearningInsightsResponse)
async def learning_insights(body: LearningInsightsRequest):
    student_id = body.student_id
    grades_json = body.grades_json
    prompt = f"Suggest 2-3 short learning insights for student {student_id} based on typical performance."
    text = await chat(prompt)
    insights = text if text else "Focus on consistent practice in weaker subjects. Consider peer study groups."
    return LearningInsightsResponse(insights=insights)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
