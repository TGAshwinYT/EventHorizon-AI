# Requirements Document

## Introduction

EventHorizon AI is a voice-first, multilingual AI assistant platform designed specifically for rural Indian agricultural communities. The system provides intelligent conversational AI capabilities, real-time agricultural market intelligence, skill development resources, and comprehensive user management features. The platform supports 9 Indian languages and integrates Google Gemini AI for natural language understanding, Edge TTS for high-quality speech synthesis, and real-time search capabilities for market data.

## Glossary

- **System**: The EventHorizon AI platform (frontend + backend)
- **User**: A registered individual accessing the platform
- **AI_Assistant**: The Google Gemini-powered conversational agent
- **Voice_Service**: The audio processing subsystem handling STT and TTS
- **Chat_Manager**: The component managing conversation history and message flow
- **Market_Service**: The subsystem providing agricultural market intelligence
- **Skills_Service**: The component managing educational course content
- **Auth_Service**: The authentication and authorization subsystem
- **Language_Code**: ISO 639-1 language identifier (en, hi, bn, te, mr, ta, gu, kn, ml)
- **Message**: A single conversational exchange unit (user or AI)
- **Session**: An authenticated user's active connection period
- **Voice_Orb**: The UI component for voice interaction
- **TTS**: Text-to-Speech conversion service
- **STT**: Speech-to-Text conversion service
- **JWT_Token**: JSON Web Token for authentication
- **Chat_History**: Persistent storage of user-AI conversations
- **Course**: An educational module with videos and study materials
- **Market_Rate**: Current agricultural commodity pricing information
- **Scheme**: Government agricultural support program
- **Vehicle**: Agricultural machinery or transport equipment

## Requirements

### Requirement 1: User Authentication and Registration

**User Story:** As a new user, I want to register and log in to the platform, so that I can access personalized features and maintain my conversation history.

#### Acceptance Criteria

1. WHEN a user provides a unique username and password, THE Auth_Service SHALL create a new user account with hashed credentials
2. WHEN a user attempts to register with an existing username, THE Auth_Service SHALL reject the registration and return an error message
3. WHEN a user provides valid credentials for login, THE Auth_Service SHALL generate a JWT_Token with 30-minute expiration
4. WHEN a user provides invalid credentials, THE Auth_Service SHALL reject the login attempt and return an authentication error
5. WHEN a JWT_Token expires, THE System SHALL require re-authentication before allowing protected operations
6. THE System SHALL store user credentials using PBKDF2-SHA256 password hashing
7. WHEN a user logs out, THE System SHALL clear local authentication tokens

### Requirement 2: Multilingual Language Selection

**User Story:** As a user, I want to select my preferred language from 9 Indian languages, so that I can interact with the system in my native language.

#### Acceptance Criteria

1. THE System SHALL support the following Language_Codes: en, hi, bn, te, mr, ta, gu, kn, ml
2. WHEN a user selects a Language_Code, THE System SHALL persist the selection in local storage
3. WHEN a user changes their Language_Code, THE System SHALL update all UI text to the selected language immediately
4. WHEN a user returns to the platform, THE System SHALL load their previously selected Language_Code
5. THE System SHALL provide localized UI strings for all navigation elements, buttons, and labels in all supported languages
6. WHEN no Language_Code is explicitly set, THE System SHALL default to English (en)

### Requirement 3: Voice-Based Interaction

**User Story:** As a user, I want to interact with the AI assistant using voice input, so that I can communicate naturally without typing.

#### Acceptance Criteria

1. WHEN a user taps the Voice_Orb in idle state, THE System SHALL request microphone permissions and begin audio recording
2. WHEN the System is recording audio, THE Voice_Orb SHALL display a listening animation with waveform visualization
3. WHEN a user taps the Voice_Orb during recording, THE System SHALL stop recording and process the captured audio
4. WHEN audio recording stops, THE System SHALL send the audio data to the backend for transcription
5. THE Voice_Service SHALL transcribe audio input using the user's selected Language_Code
6. WHEN transcription completes, THE System SHALL display the transcribed text in the chat interface
7. WHEN the user taps the Voice_Orb during AI speech playback, THE System SHALL immediately stop audio playback
8. THE System SHALL support audio input in WebM format from browser MediaRecorder API

### Requirement 4: Text-to-Speech Response Generation

**User Story:** As a user, I want to hear AI responses spoken aloud in my selected language, so that I can receive information without reading.

#### Acceptance Criteria

1. WHEN the AI_Assistant generates a text response, THE Voice_Service SHALL convert it to speech using Edge TTS
2. THE Voice_Service SHALL select the appropriate voice based on the user's Language_Code
3. THE System SHALL use gender-appropriate neural voices for each supported language
4. WHEN TTS audio is ready, THE System SHALL automatically play the audio response
5. WHEN audio playback begins, THE Voice_Orb SHALL display a speaking animation
6. WHEN audio playback completes, THE Voice_Orb SHALL return to idle state
7. THE System SHALL remove markdown formatting characters before TTS conversion
8. WHEN a user requests to replay a message, THE System SHALL generate fresh TTS audio for that message

### Requirement 5: Conversational AI Integration

**User Story:** As a user, I want to have intelligent conversations with an AI assistant, so that I can get answers to my agricultural and general questions.

#### Acceptance Criteria

1. WHEN a user sends a text or voice message, THE AI_Assistant SHALL generate a contextually relevant response using Google Gemini API
2. THE AI_Assistant SHALL support three context modes: general, agriculture, and education
3. WHEN the context is agriculture, THE AI_Assistant SHALL provide expert agricultural advice for Indian farming conditions
4. WHEN the context is education, THE AI_Assistant SHALL act as a vocational training expert
5. THE AI_Assistant SHALL structure responses with a summary section and a details section separated by "|||"
6. WHEN the AI_Assistant encounters rate limiting (HTTP 429), THE System SHALL retry with exponential backoff up to 3 attempts
7. THE AI_Assistant SHALL support multimodal input combining audio data and text instructions
8. WHEN processing audio input, THE AI_Assistant SHALL transcribe the speech and provide a response in the format "Transcribed: [text]\nResponse: [answer]"

### Requirement 6: Real-Time Market Intelligence with Search

**User Story:** As a farmer, I want to search for current crop prices and market trends, so that I can make informed selling decisions.

#### Acceptance Criteria

1. WHEN a user searches for a crop in the market rates section, THE System SHALL use Google Search integration to find real-time market data
2. THE Market_Service SHALL format responses with localized labels for "Today's Rate", "Yesterday's Rate", and "Trend"
3. THE System SHALL provide market rate responses in the user's selected Language_Code
4. WHEN displaying market rates, THE System SHALL show a summary section with current pricing information
5. WHEN a user requests more details, THE System SHALL provide trend analysis and cultivation advice
6. THE System SHALL support market queries for common Indian agricultural commodities
7. THE Market_Service SHALL structure responses as: "[Today's Rate]: [value]\n[Yesterday's Rate]: [value]\n[Trend]: [explanation]\n||| [detailed analysis]"

### Requirement 7: Agricultural Vehicle Information

**User Story:** As a farmer, I want to browse agricultural vehicles with specifications and pricing, so that I can research equipment purchases.

#### Acceptance Criteria

1. THE System SHALL provide a catalog of at least 5 agricultural vehicles including tractors and transport vehicles
2. WHEN displaying vehicles, THE System SHALL show name, type, price, purpose, and image for each vehicle
3. WHEN a user selects a vehicle, THE System SHALL display detailed specifications including engine, gearbox, brakes, and warranty information
4. THE System SHALL provide vehicle information localized in all 9 supported languages
5. WHEN viewing vehicle details, THE System SHALL provide a link to the manufacturer's official page
6. THE System SHALL include vehicles from major Indian agricultural equipment manufacturers
7. THE System SHALL display vehicle images from reliable sources with proper attribution

### Requirement 8: Government Schemes Information

**User Story:** As a farmer, I want to learn about government agricultural schemes, so that I can access subsidies and financial support.

#### Acceptance Criteria

1. THE System SHALL provide information on at least 4 major government agricultural schemes
2. WHEN displaying schemes, THE System SHALL show scheme name, details, eligibility criteria, and application links
3. THE System SHALL provide scheme information localized in all 9 supported languages
4. WHEN viewing a scheme, THE System SHALL provide a link to the official application portal
5. WHEN viewing a scheme, THE System SHALL provide a link to an explanatory video in the user's language
6. THE System SHALL include schemes such as PM-KISAN, Fasal Bima Yojana, Kisan Credit Card, and e-NAM
7. THE System SHALL support text-to-speech playback of scheme details

### Requirement 9: Skill Development Courses

**User Story:** As a user, I want to access vocational training courses, so that I can learn new skills for agricultural and rural employment.

#### Acceptance Criteria

1. THE System SHALL provide at least 8 skill development courses including electrician, solar tech, carpentry, marketing, organic farming, equipment maintenance, English, and mathematics
2. WHEN displaying courses, THE System SHALL show course name, duration, cost, icon, and description
3. WHEN a user opens a course, THE System SHALL display study materials and video content
4. THE System SHALL support multiple video lessons per course with titles and YouTube embed links
5. WHEN viewing course videos, THE System SHALL allow users to switch between different lessons
6. THE System SHALL provide course descriptions and study materials localized in all 9 supported languages
7. THE System SHALL track which video lesson is currently active for each course
8. THE System SHALL display course content in a structured format with modules and topics

### Requirement 10: Chat History Management

**User Story:** As a user, I want my conversation history to be saved and retrievable, so that I can review past interactions.

#### Acceptance Criteria

1. WHEN a user sends a message, THE Chat_Manager SHALL store the message with timestamp, sender type, and user association
2. WHEN the AI_Assistant responds, THE Chat_Manager SHALL store the response with timestamp and user association
3. WHEN a user logs in, THE System SHALL retrieve and display their complete Chat_History in chronological order
4. WHEN a user deletes a specific message, THE Chat_Manager SHALL remove that message from Chat_History
5. WHEN a user clears all history, THE Chat_Manager SHALL delete all messages associated with that user
6. THE System SHALL persist Chat_History in a relational database with foreign key constraints
7. THE System SHALL only allow users to access their own Chat_History
8. WHEN displaying Chat_History, THE System SHALL show messages in conversation format with user and AI avatars

### Requirement 11: Message Display and Interaction

**User Story:** As a user, I want to view my conversations in a clear chat interface with options to replay audio, so that I can review information effectively.

#### Acceptance Criteria

1. WHEN displaying messages, THE System SHALL show user messages aligned to the right with blue styling
2. WHEN displaying messages, THE System SHALL show AI messages aligned to the left with purple/white styling
3. WHEN a message contains the "|||" delimiter, THE System SHALL split it into summary and details sections
4. WHEN a message has details, THE System SHALL show a "More Details" button to expand the full content
5. WHEN a user clicks "More Details", THE System SHALL expand the details section and read it aloud via TTS
6. WHEN a user clicks "Show Less", THE System SHALL collapse the details section
7. WHEN a user clicks the volume icon on an AI message, THE System SHALL generate and play TTS audio for that message
8. THE System SHALL display message timestamps in localized time format
9. THE System SHALL auto-scroll to the latest message when new messages arrive

### Requirement 12: User Profile and Settings Management

**User Story:** As a user, I want to manage my profile, language preferences, and data, so that I can customize my experience and maintain privacy.

#### Acceptance Criteria

1. WHEN a user accesses settings, THE System SHALL display tabs for profile, history, language, and data management
2. WHEN a user updates their display name, THE System SHALL persist the change and update the UI immediately
3. WHEN a user changes their language preference in settings, THE System SHALL apply the change globally
4. WHEN a user requests to download their data, THE System SHALL generate a JSON file containing profile information and Chat_History
5. WHEN a user views their history in settings, THE System SHALL display all messages in reverse chronological order
6. WHEN a user deletes a message from settings, THE System SHALL remove it from Chat_History
7. WHEN a user clears all history from settings, THE System SHALL prompt for confirmation before deletion
8. WHEN a user logs out, THE System SHALL clear authentication tokens and return to the login screen

### Requirement 13: Voice Status Indication

**User Story:** As a user, I want clear visual feedback about the system's voice processing state, so that I know when to speak and when the system is responding.

#### Acceptance Criteria

1. WHEN the System is idle, THE Voice_Orb SHALL display a static microphone icon with subtle glow
2. WHEN the System is listening, THE Voice_Orb SHALL display animated waveform bars and red background
3. WHEN the System is thinking, THE Voice_Orb SHALL display a spinning loader with purple background
4. WHEN the System is speaking, THE Voice_Orb SHALL display a rotating ring with blue background
5. THE System SHALL display status text below the Voice_Orb indicating current state in the user's language
6. WHEN the System transitions between states, THE Voice_Orb SHALL animate smoothly
7. THE System SHALL prevent new voice input while in thinking or speaking states

### Requirement 14: Marketing Success Stories

**User Story:** As a farmer, I want to read success stories from other farmers, so that I can learn from their experiences and strategies.

#### Acceptance Criteria

1. WHEN a user accesses the marketing section, THE System SHALL display at least 3 agricultural success stories
2. WHEN displaying stories, THE System SHALL show farmer name, location, and content summary
3. WHEN a user searches for a marketing topic, THE System SHALL generate relevant success stories using the AI_Assistant
4. THE System SHALL provide success stories localized in the user's selected Language_Code
5. WHEN viewing a story, THE System SHALL support text-to-speech playback of the content
6. THE System SHALL format success stories with visual placeholders for farmer images
7. THE System SHALL generate stories dynamically based on user search queries

### Requirement 15: Responsive UI and Navigation

**User Story:** As a user, I want to navigate between different sections of the platform easily, so that I can access all features efficiently.

#### Acceptance Criteria

1. THE System SHALL provide a sidebar navigation with tabs for Home, Agriculture, Skills, and Settings
2. WHEN a user clicks a navigation tab, THE System SHALL switch to that section immediately
3. THE System SHALL highlight the active navigation tab with visual styling
4. WHEN in a subsection, THE System SHALL provide a back button to return to the previous view
5. THE System SHALL display navigation labels in the user's selected Language_Code
6. THE System SHALL maintain responsive layout for mobile and desktop screen sizes
7. WHEN switching sections, THE System SHALL preserve the user's authentication state

### Requirement 16: Text Input Alternative

**User Story:** As a user, I want to type messages instead of using voice, so that I can interact in quiet environments or when voice is not practical.

#### Acceptance Criteria

1. THE System SHALL provide a text input field in the chat interface
2. WHEN a user types a message and presses Enter, THE System SHALL send the message to the AI_Assistant
3. WHEN a user types a message and presses Shift+Enter, THE System SHALL insert a line break
4. THE System SHALL auto-resize the text input field as content grows up to a maximum height
5. WHEN the System is listening to voice input, THE System SHALL disable the text input field
6. THE System SHALL clear the text input field after successfully sending a message
7. THE System SHALL support multi-line text input with proper formatting

### Requirement 17: Database Persistence

**User Story:** As a system administrator, I want all user data and conversations to be persisted reliably, so that users can access their information across sessions.

#### Acceptance Criteria

1. THE System SHALL use SQLAlchemy ORM for database operations
2. THE System SHALL support both SQLite (development) and PostgreSQL (production) databases
3. THE System SHALL create database tables automatically on first startup
4. WHEN a user registers, THE System SHALL create a User record with unique ID, username, password hash, and timestamps
5. WHEN a message is sent, THE System SHALL create a ChatHistory record with foreign key to the User
6. THE System SHALL enforce referential integrity between User and ChatHistory tables
7. THE System SHALL handle database connection errors gracefully and log error details

### Requirement 18: API Error Handling

**User Story:** As a user, I want the system to handle errors gracefully, so that I receive helpful feedback when something goes wrong.

#### Acceptance Criteria

1. WHEN an API endpoint encounters an error, THE System SHALL return a JSON response with error details
2. WHEN authentication fails, THE System SHALL return HTTP 401 with an error message
3. WHEN a resource is not found, THE System SHALL return HTTP 404 with an error message
4. WHEN validation fails, THE System SHALL return HTTP 400 with specific validation error details
5. WHEN the Gemini API is unavailable, THE System SHALL return a user-friendly error message
6. WHEN the database connection fails, THE System SHALL log the error and return HTTP 500
7. THE System SHALL include error type and details in all error responses for debugging

### Requirement 19: Audio Service Translation

**User Story:** As a multilingual user, I want the system to translate content between languages, so that I can access information in my preferred language.

#### Acceptance Criteria

1. THE Voice_Service SHALL support translation between any two supported Language_Codes
2. WHEN translating text, THE Voice_Service SHALL use Google Translator with automatic source language detection
3. WHEN translation fails, THE Voice_Service SHALL return the original text unchanged
4. THE System SHALL translate user input to English before sending to the AI_Assistant for better reasoning
5. THE System SHALL translate AI responses to the user's selected Language_Code before display
6. THE Voice_Service SHALL handle translation errors gracefully without crashing
7. THE System SHALL log translation errors for debugging purposes

### Requirement 20: Environment Configuration

**User Story:** As a system administrator, I want to configure the system using environment variables, so that I can deploy to different environments securely.

#### Acceptance Criteria

1. THE System SHALL load configuration from .env files using python-dotenv
2. THE System SHALL require GEMINI_API_KEY environment variable for AI functionality
3. THE System SHALL require SECRET_KEY environment variable for JWT token generation
4. THE System SHALL support DATABASE_URL environment variable for database connection
5. WHEN environment variables are missing, THE System SHALL log warnings and use fallback values where appropriate
6. THE System SHALL not expose sensitive environment variables in API responses or logs
7. THE System SHALL support runtime environment variable updates for API keys via settings endpoint

### Requirement 21: CORS and Security

**User Story:** As a system administrator, I want the API to be secure and properly configured for cross-origin requests, so that the frontend can communicate safely with the backend.

#### Acceptance Criteria

1. THE System SHALL enable CORS for all API endpoints
2. THE System SHALL validate JWT tokens for all protected endpoints
3. THE System SHALL reject requests with expired or invalid JWT tokens
4. THE System SHALL include Authorization header validation for user-specific operations
5. THE System SHALL use secure password hashing with PBKDF2-SHA256
6. THE System SHALL not log or expose password hashes in any API response
7. THE System SHALL set appropriate HTTP security headers for all responses

### Requirement 22: Voice Mapping and Localization

**User Story:** As a user, I want to hear natural-sounding voices in my language, so that the audio experience feels authentic and clear.

#### Acceptance Criteria

1. THE Voice_Service SHALL map each Language_Code to a specific Edge TTS neural voice
2. THE System SHALL use Indian English voices for English (en-IN)
3. THE System SHALL use native speaker voices for all Indian languages
4. THE System SHALL use gender-appropriate voices based on language and availability
5. WHEN a Language_Code has no specific voice mapping, THE System SHALL fall back to English voice
6. THE Voice_Service SHALL generate audio in MP3 format for broad compatibility
7. THE System SHALL support voice customization through the Edge TTS voice catalog

### Requirement 23: Structured Response Formatting

**User Story:** As a user, I want AI responses to be well-structured with summaries and details, so that I can quickly understand key information and dive deeper when needed.

#### Acceptance Criteria

1. WHEN generating responses, THE AI_Assistant SHALL format output as "[Summary] ||| [Details]"
2. THE System SHALL instruct the AI_Assistant to provide 3-line summaries for general queries
3. WHEN handling market queries, THE AI_Assistant SHALL format responses with specific rate labels
4. THE System SHALL remove markdown formatting (asterisks, hashes) from market rate responses
5. WHEN the AI_Assistant cannot split a response, THE System SHALL treat the entire response as summary
6. THE System SHALL preserve the delimiter "|||" in all AI responses for proper parsing
7. THE System SHALL handle responses without delimiters gracefully by showing all content as summary

### Requirement 24: Search Integration for Market Data

**User Story:** As a farmer, I want the AI to search the internet for current market prices, so that I get the most up-to-date information.

#### Acceptance Criteria

1. WHEN a user makes a market query, THE System SHALL enable Google Search tool integration in the Gemini API request
2. THE AI_Assistant SHALL use search results to provide real-time market rate information
3. THE System SHALL instruct the AI_Assistant to find "LATEST real-time market rates" via search
4. WHEN search results are available, THE AI_Assistant SHALL cite real rates found via search
5. THE System SHALL format search-based responses with structured rate information
6. WHEN search fails, THE AI_Assistant SHALL provide estimated or historical data with appropriate disclaimers
7. THE System SHALL pass the use_search flag to the Gemini API for market-type queries

### Requirement 25: Dynamic Content Generation

**User Story:** As a user, I want the system to generate dynamic content like success stories and scheme information, so that I receive relevant and current information.

#### Acceptance Criteria

1. THE System SHALL support content generation for marketing stories, government schemes, and vehicle information
2. WHEN generating marketing content, THE AI_Assistant SHALL create 3 success stories with name, location, and content fields
3. WHEN generating scheme content, THE AI_Assistant SHALL create 3 schemes with name, details, eligibility, and links
4. WHEN generating vehicle content, THE AI_Assistant SHALL create 3 vehicles with name, type, price, purpose, and specifications
5. THE System SHALL parse JSON responses from the AI_Assistant for structured content
6. WHEN JSON parsing fails, THE System SHALL return an error with the raw response for debugging
7. THE System SHALL generate content in the user's selected Language_Code

### Requirement 26: Frontend State Management

**User Story:** As a user, I want the application to remember my preferences and state, so that I have a consistent experience across sessions.

#### Acceptance Criteria

1. THE System SHALL persist authentication tokens in browser localStorage
2. THE System SHALL persist selected Language_Code in browser localStorage
3. THE System SHALL persist username in browser localStorage
4. WHEN the application loads, THE System SHALL restore authentication state from localStorage
5. WHEN the application loads, THE System SHALL restore language preference from localStorage
6. WHEN a user logs out, THE System SHALL clear all localStorage items
7. THE System SHALL validate stored tokens on application startup and clear invalid tokens

### Requirement 27: Audio Playback Control

**User Story:** As a user, I want to control audio playback, so that I can stop unwanted audio or replay messages.

#### Acceptance Criteria

1. WHEN audio is playing, THE System SHALL display a stop button on the Voice_Orb
2. WHEN a user clicks stop during playback, THE System SHALL immediately halt audio and reset the Voice_Orb
3. WHEN a user clicks the volume icon on a message, THE System SHALL stop any currently playing audio before starting new audio
4. THE System SHALL support multiple audio sources: browser TTS and base64-encoded MP3
5. WHEN audio playback completes naturally, THE System SHALL reset the Voice_Orb to idle state
6. WHEN audio playback encounters an error, THE System SHALL log the error and reset to idle state
7. THE System SHALL prevent overlapping audio playback from multiple sources

### Requirement 28: Accessibility and Visual Feedback

**User Story:** As a user, I want clear visual feedback for all interactions, so that I understand what the system is doing at all times.

#### Acceptance Criteria

1. THE System SHALL display loading spinners during API requests
2. THE System SHALL show connection error messages when the backend is unreachable
3. THE System SHALL animate transitions between different views and states
4. THE System SHALL use color coding for different message types (blue for user, purple for AI)
5. THE System SHALL display timestamps for all messages in localized format
6. THE System SHALL show visual indicators for expandable content (chevron icons)
7. THE System SHALL provide hover effects on interactive elements for better discoverability

### Requirement 29: Course Video Management

**User Story:** As a learner, I want to watch multiple video lessons for each course, so that I can progress through structured learning content.

#### Acceptance Criteria

1. WHEN viewing a course, THE System SHALL display a list of all video lessons with titles
2. WHEN a user selects a video lesson, THE System SHALL load and play that video in the embedded player
3. THE System SHALL highlight the currently active video lesson in the playlist
4. THE System SHALL display video progress indicators showing completed vs total lessons
5. THE System SHALL embed YouTube videos using iframe with appropriate permissions
6. WHEN a course has no videos, THE System SHALL display a "No video available" message
7. THE System SHALL support courses with 1 to 10+ video lessons

### Requirement 30: Market Dashboard Navigation

**User Story:** As a farmer, I want to navigate between different market information sections, so that I can access rates, vehicles, schemes, and marketing content.

#### Acceptance Criteria

1. THE System SHALL provide a menu view with cards for Rates, Vehicles, Schemes, Marketing, and Advice
2. WHEN a user clicks a menu card, THE System SHALL navigate to that specific section
3. WHEN viewing a subsection, THE System SHALL update the header to show the current section name
4. WHEN a user clicks back from a subsection, THE System SHALL return to the menu view
5. WHEN viewing vehicle details, THE System SHALL provide a back button to return to the vehicle list
6. THE System SHALL maintain navigation state within the market dashboard
7. THE System SHALL display section names in the user's selected Language_Code

### Requirement 31: Responsive Design and Mobile Support

**User Story:** As a mobile user, I want the application to work well on my phone, so that I can access all features on the go.

#### Acceptance Criteria

1. THE System SHALL use responsive CSS grid layouts that adapt to screen size
2. THE System SHALL provide touch-friendly button sizes (minimum 44x44 pixels)
3. THE System SHALL support mobile browser MediaRecorder API for voice input
4. THE System SHALL display properly on screen widths from 320px to 2560px
5. THE System SHALL use viewport-relative units for sizing where appropriate
6. THE System SHALL hide or collapse navigation elements on small screens
7. THE System SHALL support both portrait and landscape orientations

### Requirement 32: Performance and Optimization

**User Story:** As a user, I want the application to load quickly and respond smoothly, so that I have a pleasant experience.

#### Acceptance Criteria

1. THE System SHALL cache Gemini API responses using LRU cache with size 32
2. THE System SHALL lazy-load course data only when the Skills tab is accessed
3. THE System SHALL debounce text input to prevent excessive API calls
4. THE System SHALL use CSS animations for smooth transitions
5. THE System SHALL minimize bundle size by code-splitting routes
6. THE System SHALL compress images and use appropriate formats
7. THE System SHALL implement virtual scrolling for long message lists

### Requirement 33: Logging and Debugging

**User Story:** As a developer, I want comprehensive logging, so that I can debug issues and monitor system health.

#### Acceptance Criteria

1. THE System SHALL log all API requests with method, path, and status code
2. THE System SHALL log authentication failures with username and timestamp
3. THE System SHALL log Gemini API errors with full error details
4. THE System SHALL log database errors with query context
5. THE System SHALL log TTS generation with language and text length
6. THE System SHALL provide a debug endpoint showing database and module status
7. THE System SHALL not log sensitive information like passwords or API keys in plain text

### Requirement 34: Internationalization (i18n) Support

**User Story:** As a developer, I want a structured approach to translations, so that adding new languages is straightforward.

#### Acceptance Criteria

1. THE System SHALL maintain translation dictionaries for all UI strings in all supported languages
2. THE System SHALL use language-specific date and time formatting
3. THE System SHALL support right-to-left (RTL) text rendering if needed for future languages
4. THE System SHALL provide fallback to English for any missing translations
5. THE System SHALL validate that all UI strings have translations in all supported languages
6. THE System SHALL use Unicode encoding for all text storage and transmission
7. THE System SHALL support language-specific number and currency formatting

### Requirement 35: API Rate Limiting and Retry Logic

**User Story:** As a system administrator, I want the system to handle API rate limits gracefully, so that users experience minimal disruption.

#### Acceptance Criteria

1. WHEN the Gemini API returns HTTP 429, THE System SHALL wait before retrying
2. THE System SHALL implement exponential backoff with base delay of 2 seconds
3. THE System SHALL retry failed requests up to 3 times before giving up
4. THE System SHALL add random jitter to retry delays to prevent thundering herd
5. WHEN max retries are exceeded, THE System SHALL return a user-friendly error message
6. THE System SHALL log all rate limit encounters for monitoring
7. THE System SHALL not retry on client errors (4xx except 429)
