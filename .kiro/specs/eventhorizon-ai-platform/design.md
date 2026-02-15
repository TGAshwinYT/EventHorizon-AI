# Design Document

## Overview

EventHorizon AI is a full-stack web application designed to provide voice-first, multilingual AI assistance to rural Indian agricultural communities. The system architecture follows a client-server model with a React-based frontend and a Python Flask backend, integrated with Google Gemini AI for natural language processing, Edge TTS for speech synthesis, and Google Translate for multilingual support.

The platform enables farmers and rural users to:
- Interact with an AI assistant through voice or text in their native language
- Access real-time agricultural market intelligence with search-powered data
- Browse government schemes and agricultural equipment information
- Learn new skills through structured video courses
- Maintain persistent conversation history across sessions

The design prioritizes accessibility, multilingual support, and offline-capable architecture where possible, with a focus on low-bandwidth optimization for rural connectivity.

## Architecture

### System Architecture

The system follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  React Frontend (TypeScript + Vite + TailwindCSS)     │ │
│  │  - Voice Orb Component                                 │ │
│  │  - Chat Interface                                      │ │
│  │  - Market Dashboard                                    │ │
│  │  - Skills Dashboard                                    │ │
│  │  - Settings & Profile                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Flask Backend (Python)                                │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │ Auth Router  │  │ Chat Router  │  │Voice Router │ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │ │
│  │  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │Market Router │  │   Services   │                  │ │
│  │  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQLAlchemy ORM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Database (SQLite/PostgreSQL)                          │ │
│  │  - Users Table                                         │ │
│  │  - ChatHistory Table                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

External Services:
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Google Gemini AI │  │   Edge TTS       │  │ Google Translate │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Component Interaction Flow

**Voice Interaction Flow:**
```
User → Voice Orb → MediaRecorder API → Backend /api/chat
                                          ↓
                                    Gemini Service (transcribe + respond)
                                          ↓
                                    Audio Service (TTS)
                                          ↓
                                    Frontend ← Base64 Audio
                                          ↓
                                    Audio Playback
```

**Text Interaction Flow:**
```
User → Text Input → Backend /api/chat
                        ↓
                  Language Detection
                        ↓
                  Translation (if needed)
                        ↓
                  Gemini Service (respond)
                        ↓
                  Translation (to user language)
                        ↓
                  Frontend ← Response Text
                        ↓
                  TTS Generation (optional)
```

**Market Search Flow:**
```
User → Market Search → Backend /api/chat (type: market)
                            ↓
                      Gemini Service (with Google Search enabled)
                            ↓
                      Real-time Market Data
                            ↓
                      Structured Response Formatting
                            ↓
                      Frontend ← Formatted Market Data
```

## Components and Interfaces

### Frontend Components

#### 1. App Component
**Purpose:** Root component managing global state and routing

**State:**
- `token`: JWT authentication token
- `username`: Current user's display name
- `language`: Selected language code
- `voiceStatus`: Current voice interaction state (idle/listening/thinking/speaking)
- `messages`: Array of chat messages
- `activeTab`: Current navigation tab

**Methods:**
- `handleLogin(token, username)`: Authenticate user and store credentials
- `handleLogout()`: Clear authentication and reset state
- `handleChat(text, audioBlob)`: Process user input and get AI response
- `startRecording()`: Initialize audio capture
- `stopRecording()`: Finalize audio capture and send to backend
- `playAudioResponse(url)`: Play TTS audio response
- `stopSpeaking()`: Halt current audio playback

**Interface:**
```typescript
interface AppState {
  token: string | null;
  username: string | null;
  language: string;
  voiceStatus: 'idle' | 'listening' | 'thinking' | 'speaking';
  messages: Message[];
  activeTab: 'home' | 'agriculture' | 'skills' | 'settings';
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}
```

#### 2. VoiceOrb Component
**Purpose:** Visual representation of voice interaction state

**Props:**
- `status`: Current voice state
- `size`: Display size variant

**Behavior:**
- Displays animated waveforms during listening
- Shows spinning loader during thinking
- Displays rotating ring during speaking
- Provides visual feedback for all state transitions

**Interface:**
```typescript
interface VoiceOrbProps {
  status: 'idle' | 'listening' | 'thinking' | 'speaking';
  size?: 'sm' | 'md';
}
```

#### 3. ChatBox Component
**Purpose:** Display conversation history with interactive features

**Props:**
- `messages`: Array of conversation messages
- `onReadAloud`: Callback to trigger TTS for a message

**Features:**
- Splits messages by "|||" delimiter into summary/details
- Expandable details sections
- Per-message TTS playback
- Auto-scroll to latest message
- Timestamp display

**Interface:**
```typescript
interface ChatBoxProps {
  messages: Message[];
  onReadAloud: (text: string) => void;
}
```

#### 4. MarketDashboard Component
**Purpose:** Agricultural market intelligence interface

**State:**
- `view`: Current dashboard view (menu/rates/vehicles/schemes/marketing)
- `searchTerm`: User's search query
- `ratesResult`: Market rate search results
- `selectedVehicleIndex`: Currently viewed vehicle
- `stories`: Marketing success stories

**Methods:**
- `handleRateSearch()`: Search for crop market rates
- `fetchGeneric(type, topic)`: Generate dynamic content via AI
- `playTTS(text)`: Text-to-speech for content

**Interface:**
```typescript
interface MarketDashboardProps {
  onBack: () => void;
  currentLanguage: string;
  labels: LocalizedLabels;
  onMoreDetails?: (query: string) => void;
}

type View = 'menu' | 'rates' | 'vehicles' | 'vehicle_details' | 'schemes' | 'advice' | 'marketing';
```

#### 5. SkillsDashboard Component
**Purpose:** Educational course browser and video player

**State:**
- `selectedCourse`: Currently viewed course
- `activeVideo`: Currently playing video URL

**Features:**
- Course catalog with descriptions
- Multi-video course support
- Video playlist with progress tracking
- Study materials display

**Interface:**
```typescript
interface SkillsDashboardProps {
  onBack: () => void;
  courses: Course[];
  headerText?: string;
  labels: LocalizedLabels;
}

interface Course {
  id: string;
  name: string;
  duration: string;
  cost: string;
  description: string;
  study_material?: string;
  videos?: VideoLesson[];
}

interface VideoLesson {
  title: string;
  url: string;
}
```

#### 6. Settings Component
**Purpose:** User profile and preference management

**State:**
- `activeTab`: Current settings section
- `newUsername`: Updated display name
- `status`: Feedback message

**Features:**
- Profile editing
- Conversation history management
- Language preference selection
- Data export functionality

**Interface:**
```typescript
interface SettingsProps {
  onBack: () => void;
  messages: Message[];
  onDeleteMessage: (id: string) => void;
  onClearHistory: () => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  username: string | null;
  onUpdateProfile: (name: string) => void;
  onLogout: () => void;
}
```

### Backend Components

#### 1. Authentication Service
**Purpose:** User registration, login, and JWT token management

**Functions:**
- `get_password_hash(password)`: Hash password using PBKDF2-SHA256
- `verify_password(plain, hashed)`: Verify password against hash
- `create_access_token(data)`: Generate JWT with 30-minute expiration
- `decode_access_token(token)`: Validate and decode JWT

**Configuration:**
- Algorithm: HS256
- Token expiration: 30 minutes
- Secret key: Environment variable

**Interface:**
```python
def create_access_token(data: dict) -> str:
    """Generate JWT token with expiration"""
    pass

def decode_access_token(token: str) -> Optional[dict]:
    """Validate and decode JWT token"""
    pass
```

#### 2. Gemini Service
**Purpose:** AI conversation and content generation

**Features:**
- Text and multimodal (audio + text) input support
- Context-aware responses (general/agriculture/education)
- Google Search integration for real-time data
- Retry logic with exponential backoff
- Response caching (LRU cache, size 32)

**Methods:**
- `generate_response(message, audio_data, context, use_search)`: Generate AI response
- `_mock_response(message, context)`: Fallback when API unavailable

**Configuration:**
- Model: gemini-2.5-flash
- Max retries: 3
- Base delay: 2 seconds
- Cache size: 32 entries

**Interface:**
```python
class GeminiService:
    def generate_response(
        self,
        message: str,
        audio_data: Optional[bytes] = None,
        audio_mime_type: str = "audio/mp3",
        context: str = "general",
        use_search: bool = False
    ) -> str:
        """Generate AI response with optional audio input and search"""
        pass
```

#### 3. Audio Service
**Purpose:** Speech-to-text, text-to-speech, and translation

**Features:**
- Edge TTS integration for high-quality speech synthesis
- Language-specific voice mapping
- Google Translate integration
- Audio format handling (WebM, MP3)

**Methods:**
- `text_to_speech(text, lang)`: Convert text to speech audio
- `speech_to_text(audio_bytes, lang)`: Transcribe audio to text
- `translate_text(text, target_lang)`: Translate between languages

**Voice Mapping:**
```python
VOICE_MAP = {
    'en': 'en-IN-PrabhatNeural',
    'hi': 'hi-IN-MadhurNeural',
    'bn': 'bn-IN-BashkarNeural',
    'te': 'te-IN-MohanNeural',
    'mr': 'mr-IN-ManoharNeural',
    'ta': 'ta-IN-ValluvarNeural',
    'gu': 'gu-IN-DhwaniNeural',
    'kn': 'kn-IN-GaganNeural',
    'ml': 'ml-IN-MidhunNeural'
}
```

**Interface:**
```python
class AudioService:
    def text_to_speech(self, text: str, lang: str = 'en') -> Optional[bytes]:
        """Convert text to MP3 audio"""
        pass
    
    def translate_text(self, text: str, target_lang: str) -> str:
        """Translate text to target language"""
        pass
```

#### 4. Chat Router
**Purpose:** Handle chat interactions and message history

**Endpoints:**
- `POST /api/chat/`: Process chat message (text or audio)
- `GET /api/chat/history`: Retrieve user's chat history
- `DELETE /api/chat/history`: Clear all user history
- `DELETE /api/chat/history/<id>`: Delete specific message
- `POST /api/chat/tts`: Generate TTS for text
- `POST /api/chat/generate`: Generate dynamic content

**Request Processing:**
1. Extract user message (text or audio)
2. Authenticate user via JWT
3. Detect or use specified language
4. Translate input to English if needed
5. Generate AI response with appropriate context
6. Translate response to user's language
7. Generate TTS audio if requested
8. Save conversation to database
9. Return response with audio URL

**Interface:**
```python
@router.route('/', methods=['POST'])
def chat_endpoint():
    """
    Main chat endpoint supporting text and voice input
    Returns: {
        response_text: str,
        user_text: str,
        audio_url: Optional[str],
        detected_language: str
    }
    """
    pass
```

#### 5. Market Router
**Purpose:** Provide agricultural market data and courses

**Endpoints:**
- `GET /api/market/`: Get static market data
- `GET /api/market/courses`: Get skill development courses with localization

**Features:**
- Localized course content for 9 languages
- Static vehicle data with specifications
- Government scheme information
- Dynamic content generation via Gemini

**Interface:**
```python
@router.route('/courses', methods=['GET'])
def get_courses():
    """
    Get localized course catalog
    Query params: language (default: en)
    Returns: List[Course]
    """
    pass
```

#### 6. Voice Router
**Purpose:** Standalone voice processing endpoints

**Endpoints:**
- `POST /api/voice/transcribe`: Convert audio to text
- `POST /api/voice/synthesize`: Convert text to audio
- `POST /api/voice/translate`: Translate text between languages

**Interface:**
```python
@router.route("/transcribe", methods=['POST'])
def transcribe_audio():
    """
    Transcribe audio to text
    Form data: audio (file), language (str)
    Returns: {text: str, language: str}
    """
    pass
```

## Data Models

### User Model
**Purpose:** Store user account information

**Schema:**
```python
class User(Base):
    __tablename__ = "users"
    
    id: int (Primary Key, Auto-increment)
    username: str (Unique, Indexed)
    password_hash: str
    api_key_gemini: str (Optional)
    api_key_huggingface: str (Optional)
    created_at: datetime (Default: UTC now)
    
    # Relationships
    chats: List[ChatHistory] (One-to-Many)
```

**Constraints:**
- Username must be unique
- Password must be hashed before storage
- Created_at automatically set on insertion

**Indexes:**
- Primary key on id
- Unique index on username

### ChatHistory Model
**Purpose:** Store conversation messages

**Schema:**
```python
class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id: int (Primary Key, Auto-increment)
    user_id: int (Foreign Key → users.id)
    message: str (Text field)
    sender: str ('user' or 'ai')
    timestamp: datetime (Default: UTC now)
    
    # Relationships
    owner: User (Many-to-One)
```

**Constraints:**
- user_id must reference valid User
- sender must be 'user' or 'ai'
- Timestamp automatically set on insertion

**Indexes:**
- Primary key on id
- Foreign key on user_id
- Composite index on (user_id, timestamp) for efficient history queries

### Database Configuration

**Connection:**
- Development: SQLite (file-based)
- Production: PostgreSQL (via DATABASE_URL env var)
- Connection pooling via SQLAlchemy
- Auto-create tables on startup

**Session Management:**
```python
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Authentication and Authorization Properties

Property 1: User Registration with Unique Usernames
*For any* valid username and password combination, when a user attempts to register, the system should create a new user account with a hashed password if the username is unique, or reject the registration if the username already exists.
**Validates: Requirements 1.1, 1.2**

Property 2: JWT Token Generation and Validation
*For any* valid user credentials, when a user logs in, the system should generate a JWT token with exactly 30-minute expiration, and any request with an expired token should be rejected.
**Validates: Requirements 1.3, 1.5**

Property 3: Password Hashing Consistency
*For any* password, the system should hash it using PBKDF2-SHA256, and the same password should always verify successfully against its hash.
**Validates: Requirements 1.6**

Property 4: Authentication Error Handling
*For any* invalid credentials (wrong username or password), the login attempt should be rejected with an authentication error.
**Validates: Requirements 1.4**

### Language and Localization Properties

Property 5: Language Persistence Round-Trip
*For any* supported language code (en, hi, bn, te, mr, ta, gu, kn, ml), when a user selects it, stores it in localStorage, and reloads the application, the same language should be restored.
**Validates: Requirements 2.2, 2.6**

Property 6: UI Localization Completeness
*For any* supported language code and any UI element, the system should display text in the selected language, with all required translations present.
**Validates: Requirements 2.3, 2.5**

### Voice Interaction Properties

Property 7: Audio Processing Round-Trip
*For any* audio recording, when the system captures it, sends it to the backend, and receives a transcription, the transcription should be non-empty and displayed in the chat.
**Validates: Requirements 3.3, 3.8**

Property 8: TTS Voice Mapping
*For any* supported language code, the Voice_Service should map it to a specific Edge TTS neural voice, or fall back to English voice if no mapping exists.
**Validates: Requirements 4.2, 22.1, 22.2**

Property 9: Markdown Removal for TTS
*For any* text containing markdown characters (*, #, _, `, ~, -), the system should remove them before TTS conversion, resulting in clean audio output.
**Validates: Requirements 4.3**

Property 10: Audio Playback Control
*For any* playing audio, when a user clicks stop, the audio should immediately halt and the Voice_Orb should return to idle state.
**Validates: Requirements 27.2**

### AI Conversation Properties

Property 11: Response Structure with Delimiter
*For any* AI-generated response, it should either contain the "|||" delimiter separating summary and details, or be treated entirely as summary if the delimiter is absent.
**Validates: Requirements 5.2, 23.1, 23.2**

Property 12: Message Splitting Consistency
*For any* message containing "|||", splitting it should produce exactly two non-empty parts: summary and details.
**Validates: Requirements 11.2**

Property 13: Retry Logic with Exponential Backoff
*For any* Gemini API request that returns HTTP 429, the system should retry up to 3 times with exponentially increasing delays (2s, 4s, 8s) plus random jitter.
**Validates: Requirements 5.3, 35.1, 35.2**

Property 14: Context-Aware Response Generation
*For any* user message with a specified context (general/agriculture/education), the AI response should be generated using the appropriate system prompt for that context.
**Validates: Requirements 5.1, 5.2, 5.3**

### Market Intelligence Properties

Property 15: Market Search Integration
*For any* market-related query, the system should enable Google Search integration in the Gemini API request and format the response with localized rate labels.
**Validates: Requirements 6.1, 6.2, 24.1**

Property 16: Market Response Formatting
*For any* market query response in any supported language, it should contain localized labels for "Today's Rate", "Yesterday's Rate", and "Trend".
**Validates: Requirements 6.2**

Property 17: Vehicle Catalog Completeness
*For any* vehicle in the catalog, it should have all required fields: name, type, price, purpose, image, specifications, and official link.
**Validates: Requirements 7.2**

Property 18: Scheme Information Completeness
*For any* government scheme, it should have all required fields: name, details, eligibility, application_link, and youtube_link.
**Validates: Requirements 8.2**

### Course and Education Properties

Property 19: Course Content Completeness
*For any* course, when opened, it should display either study materials or video content (or both), with all videos having titles and valid URLs.
**Validates: Requirements 9.2**

Property 20: Course Localization
*For any* course and any supported language, the course description and study materials should be available in that language.
**Validates: Requirements 9.2**

### Chat History Properties

Property 21: Message Storage Completeness
*For any* message sent by a user or AI, it should be stored in the database with all required fields: user_id, message text, sender type, and timestamp.
**Validates: Requirements 10.1, 10.2**

Property 22: Chat History Retrieval Order
*For any* user, when they log in, their chat history should be retrieved and displayed in chronological order (oldest to newest).
**Validates: Requirements 10.2**

Property 23: Message Deletion Consistency
*For any* message in chat history, when a user deletes it, it should be removed from the database and no longer appear in subsequent history retrievals.
**Validates: Requirements 10.3**

Property 24: History Clearing Completeness
*For any* user, when they clear all history, all messages associated with that user should be deleted from the database.
**Validates: Requirements 10.4**

### User Interface Properties

Property 25: Message Styling by Sender
*For any* message displayed in the chat, user messages should be styled with blue colors and right alignment, while AI messages should be styled with purple/white colors and left alignment.
**Validates: Requirements 11.1, 28.2**

Property 26: Text Input Behavior
*For any* text in the input field, pressing Enter should send the message and clear the field, while pressing Shift+Enter should insert a line break.
**Validates: Requirements 16.1, 16.2**

Property 27: Button Size Accessibility
*For any* interactive button or touch target, its size should be at least 44x44 pixels to ensure touch-friendly interaction.
**Validates: Requirements 31.2**

### Data Persistence Properties

Property 28: User Registration Database Record
*For any* successful user registration, a User record should be created in the database with a unique ID, username, hashed password, and creation timestamp.
**Validates: Requirements 17.2**

Property 29: LocalStorage Authentication Round-Trip
*For any* authentication token, when stored in localStorage, it should be retrievable on application reload and restore the user's authenticated state.
**Validates: Requirements 26.1, 26.2**

Property 30: Profile Update Persistence
*For any* user profile update (display name), the change should be persisted to localStorage and reflected immediately in the UI.
**Validates: Requirements 12.1**

Property 31: Data Export Completeness
*For any* user requesting data download, the generated JSON file should contain their profile information and complete chat history with valid JSON structure.
**Validates: Requirements 12.2**

### Error Handling Properties

Property 32: API Error Response Format
*For any* API endpoint error, the response should be valid JSON containing error details and an appropriate HTTP status code (401 for auth, 404 for not found, 400 for validation, 500 for server errors).
**Validates: Requirements 18.1, 18.2**

Property 33: Translation Fallback
*For any* translation request that fails, the Voice_Service should return the original text unchanged rather than throwing an error.
**Validates: Requirements 19.2**

Property 34: Environment Variable Fallback
*For any* missing environment variable, the system should use a fallback value and log a warning, allowing the application to continue running.
**Validates: Requirements 20.2**

### Translation and Multilingual Properties

Property 35: Bidirectional Translation Support
*For any* two supported language codes, the Voice_Service should be able to translate text from the first language to the second language.
**Validates: Requirements 19.1**

Property 36: Input Translation for AI Processing
*For any* user input in a non-English language, the system should translate it to English before sending to the AI_Assistant, then translate the response back to the user's language.
**Validates: Requirements 19.4, 19.5**

### Performance and Caching Properties

Property 37: Response Caching Behavior
*For any* identical Gemini API request made within the cache lifetime, the system should return the cached response rather than making a new API call.
**Validates: Requirements 32.1**

Property 38: Logging Completeness
*For any* API request, a log entry should be created containing the HTTP method, path, and status code.
**Validates: Requirements 33.1**

### Dynamic Content Generation Properties

Property 39: JSON Parsing for Structured Content
*For any* AI-generated structured content (marketing stories, schemes, vehicles), the system should successfully parse it as JSON or return an error with the raw response.
**Validates: Requirements 25.1**

Property 40: Content Generation in User Language
*For any* dynamic content generation request, the generated content should be in the user's selected language.
**Validates: Requirements 25.2**

## Error Handling

### Frontend Error Handling

**Network Errors:**
- Display connection error banner when backend is unreachable
- Auto-dismiss error messages after 5 seconds
- Retry failed requests with user confirmation
- Graceful degradation for offline scenarios

**Authentication Errors:**
- Redirect to login on 401 responses
- Clear invalid tokens from localStorage
- Display user-friendly error messages
- Preserve user's intended action for post-login redirect

**Voice Input Errors:**
- Request microphone permissions with clear messaging
- Handle permission denial gracefully
- Display error if MediaRecorder API unavailable
- Fallback to text input if voice fails

**Audio Playback Errors:**
- Log audio errors to console
- Reset Voice_Orb to idle state on error
- Display error message for failed TTS
- Provide retry option for audio generation

### Backend Error Handling

**Database Errors:**
- Log full error details with stack trace
- Return HTTP 500 with generic error message
- Implement connection retry logic
- Graceful degradation for read-only operations

**External API Errors:**
- Gemini API: Retry with exponential backoff on 429
- Gemini API: Return mock response if unavailable
- Edge TTS: Log errors and return None
- Google Translate: Return original text on failure

**Validation Errors:**
- Return HTTP 400 with specific validation messages
- Validate all input parameters
- Sanitize user input to prevent injection
- Enforce data type and format constraints

**Authentication Errors:**
- Return HTTP 401 for invalid/expired tokens
- Return HTTP 403 for insufficient permissions
- Log authentication failures for security monitoring
- Rate limit login attempts to prevent brute force

### Error Response Format

All API errors follow this structure:
```json
{
  "error": "Human-readable error message",
  "details": "Technical details (optional)",
  "type": "ErrorType"
}
```

### Logging Strategy

**Log Levels:**
- ERROR: System failures, exceptions, critical issues
- WARNING: Recoverable errors, missing env vars, rate limits
- INFO: API requests, user actions, state changes
- DEBUG: Detailed execution flow, variable values

**Log Content:**
- Timestamp (UTC)
- Log level
- Component/module name
- Message
- Context (user ID, request ID, etc.)
- Stack trace (for errors)

**Security Considerations:**
- Never log passwords or API keys
- Redact sensitive user data
- Log authentication failures for security monitoring
- Implement log rotation and retention policies

## Testing Strategy

### Dual Testing Approach

The EventHorizon AI platform requires both unit testing and property-based testing to ensure comprehensive correctness:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary values, special characters)
- Error conditions (invalid credentials, missing data, API failures)
- Integration points between components
- UI component rendering and interaction

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Invariant verification across state changes
- Round-trip properties (serialization, translation, authentication)
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

**Framework Selection:**
- Frontend: fast-check (TypeScript/JavaScript)
- Backend: Hypothesis (Python)

**Test Configuration:**
```python
# Python (Hypothesis)
@given(username=text(min_size=1, max_size=50), 
       password=text(min_size=8, max_size=100))
@settings(max_examples=100)
def test_user_registration_property(username, password):
    """Feature: eventhorizon-ai-platform, Property 1: User Registration with Unique Usernames"""
    # Test implementation
```

```typescript
// TypeScript (fast-check)
fc.assert(
  fc.property(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.string({ minLength: 8, maxLength: 100 }),
    (username, password) => {
      // Feature: eventhorizon-ai-platform, Property 1: User Registration with Unique Usernames
      // Test implementation
    }
  ),
  { numRuns: 100 }
);
```

### Test Coverage Requirements

**Backend Coverage:**
- Authentication: 95%+ coverage
- Chat endpoints: 90%+ coverage
- Voice services: 85%+ coverage
- Database models: 100% coverage
- Error handling: 90%+ coverage

**Frontend Coverage:**
- Core components: 80%+ coverage
- State management: 85%+ coverage
- API integration: 75%+ coverage
- UI interactions: 70%+ coverage

### Testing Priorities

**Critical Path Tests (Must Have):**
1. User authentication and authorization
2. Message sending and receiving
3. Voice recording and playback
4. Chat history persistence
5. Language selection and localization
6. AI response generation
7. Error handling and recovery

**Important Tests (Should Have):**
1. Market data search and display
2. Course browsing and video playback
3. Profile management
4. Data export functionality
5. Translation accuracy
6. TTS voice quality
7. Responsive design

**Nice-to-Have Tests:**
1. Performance benchmarks
2. Load testing
3. Accessibility compliance
4. Cross-browser compatibility
5. Mobile device testing
6. Network resilience
7. Cache effectiveness

### Test Data Management

**Generators:**
- Random usernames (alphanumeric, 1-50 chars)
- Random passwords (mixed case, numbers, symbols, 8-100 chars)
- Random language codes (from supported set)
- Random messages (text, 1-1000 chars)
- Random audio blobs (WebM format, 1-60 seconds)
- Random timestamps (within valid range)

**Fixtures:**
- Sample user accounts
- Pre-recorded audio samples
- Mock AI responses
- Sample market data
- Course catalog data
- Localization strings

### Integration Testing

**API Integration Tests:**
- Test all REST endpoints with valid/invalid inputs
- Verify authentication flow end-to-end
- Test file upload (audio) handling
- Verify CORS configuration
- Test rate limiting behavior

**External Service Integration:**
- Mock Gemini API responses for consistent testing
- Mock Edge TTS for audio generation tests
- Mock Google Translate for translation tests
- Test fallback behavior when services unavailable

**Database Integration:**
- Test CRUD operations for all models
- Verify foreign key constraints
- Test transaction rollback on errors
- Verify data persistence across sessions

### End-to-End Testing

**User Flows:**
1. Registration → Login → Send Message → Receive Response → Logout
2. Login → Select Language → Voice Input → AI Response → TTS Playback
3. Login → Browse Market → Search Crop → View Details
4. Login → Browse Courses → Watch Video → Complete Lesson
5. Login → Settings → Update Profile → Download Data → Logout

**Cross-Browser Testing:**
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest version)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing

**Metrics:**
- API response time: < 500ms (p95)
- TTS generation time: < 2s (p95)
- Page load time: < 3s (p95)
- Time to interactive: < 5s (p95)
- Voice recording latency: < 100ms

**Load Testing:**
- Concurrent users: 100+
- Messages per second: 50+
- Database queries per second: 200+
- API requests per second: 100+

### Security Testing

**Authentication Tests:**
- Password hashing verification
- JWT token expiration
- Token tampering detection
- Session hijacking prevention
- Brute force protection

**Input Validation:**
- SQL injection prevention
- XSS attack prevention
- CSRF protection
- File upload validation
- Input sanitization

**Data Protection:**
- Sensitive data encryption
- Secure password storage
- API key protection
- User data isolation
- Audit logging

### Continuous Integration

**CI Pipeline:**
1. Lint code (ESLint, Pylint)
2. Run unit tests
3. Run property-based tests
4. Run integration tests
5. Check code coverage
6. Build application
7. Run E2E tests
8. Deploy to staging

**Quality Gates:**
- All tests must pass
- Code coverage > 80%
- No critical security vulnerabilities
- No linting errors
- Build succeeds
- Performance benchmarks met

### Test Maintenance

**Regular Updates:**
- Update test data generators
- Refresh mock responses
- Update browser versions
- Review and update test coverage
- Refactor flaky tests
- Document test failures

**Test Documentation:**
- Document test purpose and scope
- Explain complex test scenarios
- Provide examples of expected behavior
- Link tests to requirements
- Maintain test data documentation
- Document known limitations

---

## Deployment and Operations

### Deployment Architecture

**Frontend Deployment:**
- Static hosting (Vercel, Netlify, or AWS S3 + CloudFront)
- CDN for global distribution
- Automatic HTTPS
- Environment-based configuration

**Backend Deployment:**
- Container-based (Docker)
- Platform options: AWS ECS, Google Cloud Run, or Heroku
- Auto-scaling based on load
- Health check endpoints

**Database Deployment:**
- Managed PostgreSQL (AWS RDS, Google Cloud SQL, or Heroku Postgres)
- Automated backups
- Read replicas for scaling
- Connection pooling

### Environment Configuration

**Development:**
- SQLite database
- Local Flask server
- Vite dev server with HMR
- Mock external services

**Staging:**
- PostgreSQL database
- Deployed backend
- Production build
- Real external services

**Production:**
- PostgreSQL with replicas
- Load-balanced backend
- Optimized frontend build
- Monitoring and alerting

### Monitoring and Observability

**Application Metrics:**
- Request rate and latency
- Error rate by endpoint
- User authentication rate
- AI response generation time
- TTS generation time
- Database query performance

**Infrastructure Metrics:**
- CPU and memory usage
- Network throughput
- Disk I/O
- Database connections
- Cache hit rate

**Business Metrics:**
- Daily active users
- Messages per user
- Language distribution
- Feature usage (voice vs text)
- Course completion rate
- Market search queries

### Backup and Recovery

**Database Backups:**
- Automated daily backups
- Point-in-time recovery
- Backup retention: 30 days
- Backup testing: monthly

**Disaster Recovery:**
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour
- Documented recovery procedures
- Regular DR drills

### Security Considerations

**Data Protection:**
- Encryption at rest (database)
- Encryption in transit (HTTPS/TLS)
- Secure API key storage
- User data isolation

**Access Control:**
- JWT-based authentication
- Role-based access control (future)
- API rate limiting
- IP whitelisting (admin endpoints)

**Compliance:**
- GDPR compliance (data export, deletion)
- Data retention policies
- Privacy policy
- Terms of service

### Scalability Considerations

**Horizontal Scaling:**
- Stateless backend design
- Load balancer distribution
- Database read replicas
- CDN for static assets

**Vertical Scaling:**
- Database instance sizing
- Backend container resources
- Cache memory allocation

**Performance Optimization:**
- Response caching (LRU)
- Database query optimization
- Lazy loading of resources
- Image optimization
- Code splitting

### Maintenance and Updates

**Regular Maintenance:**
- Security patches
- Dependency updates
- Database optimization
- Log rotation
- Cache clearing

**Feature Releases:**
- Feature flags for gradual rollout
- A/B testing capability
- Rollback procedures
- Release notes
- User communication

---

## Future Enhancements

### Planned Features

**Enhanced AI Capabilities:**
- Multi-turn conversation context
- Personalized recommendations
- Voice emotion detection
- Proactive assistance

**Expanded Content:**
- More courses and languages
- Video content creation
- Community forums
- Expert Q&A sessions

**Advanced Features:**
- Offline mode with sync
- Push notifications
- Mobile native apps
- Voice commands
- AR/VR integration

**Analytics and Insights:**
- User behavior analytics
- Learning progress tracking
- Market trend analysis
- Personalized dashboards

### Technical Improvements

**Performance:**
- Edge computing for TTS
- WebRTC for real-time voice
- Progressive Web App (PWA)
- Service workers for offline

**Infrastructure:**
- Multi-region deployment
- Auto-scaling policies
- Cost optimization
- Green hosting

**Developer Experience:**
- GraphQL API
- API documentation (OpenAPI)
- SDK for third-party integration
- Webhook support

---

This design document provides a comprehensive blueprint for the EventHorizon AI platform, covering architecture, components, data models, correctness properties, error handling, testing strategy, and operational considerations. The design prioritizes accessibility, multilingual support, and robust error handling to serve rural Indian agricultural communities effectively.
