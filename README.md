## Study Weave: an Artifact Comparator Internet Program with Human Study Module


## Team members

Zaeem Masood Sheikh  
Ali Demir  
İsmail Yağız Güven  
Shahin Ibrahimli  
Farrukh Mammadov  

## Description 
Study Weave is a web application that is designed for the CS 319 Object Oriented Software Engineering course. This project's main goal is to create a platform that will allow researchers to conduct systematic human-subject studies so that they can evaluate and compare software engineering artifacts, such as source code, test cases, UML diagrams, and requirements documents. The system will not only facilitate the upload and management but also compare artifacts generated both manually by developers and automatically by AI tools like Large Language Models (LLMs). The participants will take part in a structured comparison of tasks where they will be providing annotations, ratings, and feedback without knowing who created the artifacts, to ensure fair and unbiased evaluation. The app will support multiple user roles, including researchers, participants, admins, and potentially others identified during the development process, with secure role-based access control.
This project uses React.js for a dynamic frontend and Node.js for  backend. The purpose is to address the growing need to fairly evaluate a variety of artifacts, especially as AI-generated content is becoming more common lately. Through this work, the team aims to demonstrate practical skills in object-oriented design, full-stack development, and collaborative project management.


## Motivation
In modern and fast-paced software development, a team lead is often faced with a choice: use a set of test cases written by a senior developer with extra care or ones that are generated instantly by an AI. Even though the AI generated artifacts are way faster to produce, the real question arises whether they are more readable, maintainable, or effective?  
  
Answering this question is currently a subjective and time consuming process, as we don't have tools for a fair and a data driven comparison. Our project Study Weave is motivated by this real world challenge. We are aiming to build a platform that empowers researchers and team leads to move beyond guesswork. By facilitating structured methods, such as blinded evaluations and side-by-side metrics on code coverage or bug detection, our project will provide a clear, unbiased environment to systematically compare human made and AI generated artifacts. Our goal is to create an essential tool that addresses a critical problem in modern software engineering: understanding the true quality of the artifacts we build and use every day. Ultimately, this will help teams boost productivity, reduce errors, and make informed decisions on integrating AI tools into workflows.

## Goals
StudyWeave's major objective is to create an operational web application that allows for software artifacts to be uploaded, administered, and compared while supporting human evaluations. Certain objectives entail the use of role-based access control, supporting variant artifact types utilizing extensible design, and inclusive comparison interfaces with support for annotations and ratings. Delivering an insecure, responsive system with study supervision dashboards, supporting both hosted and local deployments, and incorporating tool-derived metrics for deeper analysis should all be accomplished by the team. Ultimately, the initiative is aimed at improving the team's expertise in full-stack programming and object-oriented principles, aiming for high-quality deliverables suitable for academic and professional advancement.


## Problem
The issue that StudyWeave tries to tackle is the absence of a common and efficient platform for conducting human-subject studies of software engineering artifacts. Manual rule-based approaches are subjective and time-intensive, and the emergence of AI-generated artifacts makes it even more challenging due to differing quality and readability. Researchers have a hard time systematically comparing diverse artifacts, while participants do not have the tools to provide systematic and unbiased feedback. Existing solutions are commonly non-scalable, insecure, or only capable of handling a single kind of artifact and thus do not fit into research processes. StudyWeave is an attempt to address this issue by providing a modular, easily extensible web application that will make management of experiment artifacts, comparison, and data collection possible most easily, ensuring privacy and performance also with big datasets. 


## Features
To bring our vision to life, Study Weave will be built around a set of features that are designed to create a seamless workflow for both researchers, participants and others. Instead of just a list of functions, we see the application as a journey through three core modules:

1. Effortless Study Setup and Management:
Researchers will begin their journey with a powerful dashboard that allows them to create and configure new studies from start to finish.
The system will support a wide variety of software artifacts, including source code, UML diagrams, test cases, and requirements documents, with a modular design to easily accommodate new types in the future. Artifacts can be organized with tags and editable metadata (e.g., origin, language) for easy filtering and management. Also, to ensure high-quality feedback, researchers can create custom quizzes to assess participant competency, using either their own questions or leveraging AI-assisted generation.

2. An Intuitive and Interactive Evaluation Environment:
The core of the participant experience is our comparison interface, which will present two or three artifacts in a side-by-side layout with synchronized scrolling to make direct comparison easy and effective.
To prevent bias, a "blinded evaluation mode" will hide the original info of the artifacts, ensuring that feedback is unbaised and based purely on quality.
Participants can provide rich, detailed feedback by highlighting specific lines of code or text to add inline comments and annotations. They will also rate artifacts on criteria defined by researchers like readability or correctness using scales or multiple-choice questions.

3. Actionable Analytics and Reporting:
All evaluation data is collected securely and visualized on the researcher's dashboard, providing every detail and insights into study progress, participant completion rates, and rating distributions.
The system will include quality control indicators to flag potential issues, such as unusually fast responses or incomplete evaluations, helping ensure the integrity of the data.
For deeper analysis, researchers can easily export all collected data that includes ratings, comments, and annotations to downloadable reports in other formats.



## Selling points
StudyWeave is differentiated in its employments of Node.js and React.js, a current full-stack combination attractive to firm recruiters. Its extensibility is guaranteed through modular architecture, and extensibility is demonstrated in Docker deployment for scalability. Blinded evaluation models and tool integration serve to increase research value, and detailed dashboards offer actionable information, qualifying it to serve both academy and industry practically.


## Why is this interesting/cool?
The ability to compare AI vs. human artifacts in a blinded, interactive interface is a system that addresses issues researchers are facing in their studies. The system offers an efficient solution for participant management, enabling researchers to identify participants in an automated system and make the necessary adjustments; a flexible and engaging system. The solution is further developed with its blinded evaluation mode, which elicits the threats to internal validity, ensuring participant biases for an objective study. In addition to that, the system offers holistic data collection and analysis tools, displaying important solutions in reproducibility and environment-related issues.


## Extra feature(s)
To enhance the accessibility of our project and participant engagement, we propose two additional features that we believe will ensure superior feedback:

Guest User Role: 
The Guest User Role enables users that are non-registered to participate in studies without requiring account creation, broadening access to diverse feedback providers and increasing study completion rates. The role in question would have lower permissions and would only allow a user to participate in a study they were specifically invited to. Researchers can share studies through secure, shareable links or email invitations, with IP or cookie-based restrictions to prevent repeat submissions. Researchers would, of course, be able to prevent guest users from participating altogether, if they're looking for a more focused subset of participants. By making registration optional, this feature makes it easier to collect input from a wider audience, such as temporary contributors, while maintaining commitment to reliable and unbiased evaluations. We believe this feature will draw more users to studies, as mandatory registration would ordinarily discourage a large amount of possible participants.

Engagement Participant Game: 
Engagement Participant Game Module introduces a system to motivate participants, awarding points for timely task completion, detailed annotations, or feedback deemed "Helpful" by reviewers, with scores displayed on a personal dashboard alongside unlockable badges for insightful comments for efficiency. By tracking participant through an engaging, rewarding experience, this feature enhances the quality and depth of feedback, directly supporting Study Weave’s goal of collecting high quality, and date driven insights into software artifact effectiveness, while at the same time prioritizing the human element of user studies for better outcomes. This "ranking" system could then be used by researchers to pick and choose more qualified and seasoned participants, which would improve the reliability of the submissions they recieve.
