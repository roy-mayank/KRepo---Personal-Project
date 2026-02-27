### KRepo (K==Knowledge)

##### The Idea

A knowledge repository (technical and maybe even non-tech) cum onboarding AI integrations

I made the assumption that orgs could benefit from the availability of a dynamic learning environment for new employees or new complex products. Using this assumption, I decided to develop a platform where companies could upload large complex technical materials with information (in video or audio format) from senior engineers - those that are usually burdened with all the heavy information (and can technically cripple an org) - use agents to break down all the information. Then break it down into a graph learning format friendly for all levels of information.

Additional features would include:

- indexing for quick access of concepts, with the option to dive into more niche topics on each screen
- Option to ask questions ofc (chatbot)
- Where in the learning curve am I?

##### Intended Positioning Statement (temp)

Positioning: For organisations managing high complexity systems, LC is an intelligent onboarding and maintenance LMS tool that turns long technical documentation and chief engineer knowledge into digestable, graph-based learning maps reducing the amount of time and effort engineers need to keep up.

##### Technical Architecture

### MVP (Deadline: 15 March 2026)

###### Phase 1 (PDF analysis):

Langchain? (RAG) -> Pinecone (VectorDB) -> Claude Wrapper

Simple Chat layout to ask questions on large documents. No hallucniation space (every response links directly to a part of the document)

Q: What about images in manuals? Vision-capable models? but too expensive for MVP

###### Phase 2 (STT):

SuperWhisper/OpenAI Whisper -> Langchain Audio Extraction

Structured JSON extracting entity-relationships o/p from audio (but WHAT audio exactly? Zoom? intenational charting??)

###### Phase 3 (Linking):

PDF + STT mix -> PyVis -> Graph UI/UX (again wrapper maybe?)

Personalized role-specific knowledge passing based on prompts from hiring teams expectations from employee
