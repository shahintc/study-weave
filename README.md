## Study Weave: an Artifact Comparator Internet Program with Human Study Module


## Team members

Zaeem Masood Sheikh  
Ali Demir  
İsmail Yağız Güven  
Shahin Ibrahimli  
Farroukh Mammadov  

## Description 

Study Weave is a web application that is designed for the CS 319 Object Oriented Software Engineering course. This project's main goal is to create a platform that will allow researchers to conduct systematic human-subject studies so that they can evaluate and compare software engineering artifacts, such as source code, test cases, UML diagrams, and requirements documents. The system will not only facilitate the upload and management but also compare artifacts generated both manually by developers and automatically by AI tools like Large Language Models (LLMs). The participants will take part in a structured comparison of tasks where they will be providing annotations, ratings, and feedback without knowing who created the artifacts, to ensure fair and unbiased evaluation. The app will support multiple user roles, including researchers, participants, admins, and potentially others identified during the development process, with secure role-based access control.
This project uses React.js for a dynamic frontend and Node.js for  backend. The purpose is to address the growing need to fairly evaluate a variety of artifacts, especially as AI-generated content is becoming more common lately. Through this work, the team aims to demonstrate practical skills in object-oriented design, full-stack development, and collaborative project management.


## Motivation
Study Weave is motivated by the increasing complexity of software engineering artifacts, both authored and produced by AI tools, hand and machine, respectively. Their quality, readability, and usability evaluation is human-centered, time-consuming, yet essential for improving software development practices. This project aims to offer an environment in which researchers perform controlled human-subject studies, providing a methodical way to compare such artifacts, e.g., LLM-created test cases versus human-created test cases, or AI-authored docs versus hand-authored docs, by and large mirroring real-world research requirements and readying the team for real-world industry challenges in that it models the entire cycle of a software's development lifecycle.


## Goals
StudyWeave's major objective is to create an operational web application that allows for software artifacts to be uploaded, administered, and compared while supporting human evaluations. Certain objectives entail the use of role-based access control, supporting variant artifact types utilizing extensible design, and inclusive comparison interfaces with support for annotations and ratings. Delivering an insecure, responsive system with study supervision dashboards, supporting both hosted and local deployments, and incorporating tool-derived metrics for deeper analysis should all be accomplished by the team. Ultimately, the initiative is aimed at improving the team's expertise in full-stack programming and object-oriented principles, aiming for high-quality deliverables suitable for academic and professional advancement.


## Problem
The issue that StudyWeave tries to tackle is the absence of a common and efficient platform for conducting human-subject studies of software engineering artifacts. Manual rule-based approaches are subjective and time-intensive, and the emergence of AI-generated artifacts makes it even more challenging due to differing quality and readability. Researchers have a hard time systematically comparing diverse artifacts, while participants do not have the tools to provide systematic and unbiased feedback. Existing solutions are commonly non-scalable, insecure, or only capable of handling a single kind of artifact and thus do not fit into research processes. StudyWeave is an attempt to address this issue by providing a modular, easily extensible web application that will make management of experiment artifacts, comparison, and data collection possible most easily, ensuring privacy and performance also with big datasets. 


## Features
Secure registration, login, and role-based access for researchers, participants, and admins.
Capability to upload and store diverse artifacts (code, UML, docs, etc.) with tagging and metadata editing.
Pre-study questionnaires and AI-assisted quizzes to gauge participant skills.
Side-by-side or 3-way views with synchronized scrolling, annotations, and ratings.
Dashboards for researchers (stats, analytics) and participants (task tracking, history).
Support for local (Docker-based) and hosted modes across multiple OSes.
Built-in analysis tools (e.g., complexity calculators) for real-time feedback.



## Selling points
StudyWeave is differentiated in its employments of Node.js and React.js, a current full-stack combination attractive to firm recruiters. Its extensibility is guaranteed through modular architecture, and extensibility is demonstrated in Docker deployment for scalability. Blinded evaluation models and tool integration serve to increase research value, and detailed dashboards offer actionable information, qualifying it to serve both academy and industry practically.


## Why is this interesting/cool?
The ability to compare AI vs. human artifacts in a blinded, interactive interface is a system that addresses issues researchers are facing in their studies. The system offers an efficient solution for participant management, enabling researchers to identify participants in an automated system and make the necessary adjustments; a flexible and engaging system. The solution is further developed with its blinded evaluation mode, which elicits the threats to internal validity, ensuring participant biases for an objective study. In addition to that, the system offers holistic data collection and analysis tools, displaying important solutions in reproducibility and environment-related issues.


## Extra feature(s)
An extra feature could be to add a “guest” user role, where users who haven’t signed in as participants can still join a user-study, which could require some IP or cookie banning to prevent the same user from redoing the study. Methods to send these studies to guest participants or invite them could also be implemented as needed. 
