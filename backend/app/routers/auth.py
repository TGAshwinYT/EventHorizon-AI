from flask import Blueprint, request, jsonify
from app.database import get_db, SessionLocal
from app.models import User
from app.auth import get_password_hash, verify_password, create_access_token
from sqlalchemy.orm import Session

router = Blueprint('auth', __name__)

@router.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    db: Session = SessionLocal()
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        db.close()
        return jsonify({"error": "Username already exists"}), 400

    hashed_pw = get_password_hash(password)
    new_user = User(username=username, password_hash=hashed_pw)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.close()

    return jsonify({"message": "User registered successfully"}), 201

@router.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    db: Session = SessionLocal()
    user = db.query(User).filter(User.username == username).first()
    db.close()

    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = create_access_token(data={"sub": user.username})
    return jsonify({"access_token": access_token, "token_type": "bearer", "username": user.username}), 200
