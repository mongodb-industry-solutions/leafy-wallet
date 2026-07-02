# Demo Template: Python Backend

Python backend section built using [FastAPI](https://fastapi.tiangolo.com/). The backend is managed using uv for dependency management, offering a RESTful API.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Backend Setup](#backend-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

- Python backend with a RESTful API powered by FastAPI
- Dependency management with uv ([More info](https://docs.astral.sh/uv/))
- Easy setup and configuration

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Python 3.13 (but less than 3.14)
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))

For complete setup instructions, including how to create a new repository and clone it, please refer to the [parent README](../README.md).

## Getting Started

Follow these steps to set up the backend project locally. For detailed instructions on creating a new repository and using GitHub Desktop, please refer to the [parent README](../README.md).

### Backend Setup

1. (Optional) Set your project description and author information in the `pyproject.toml` file:
   ```toml
   description = "Your Description"
   authors = ["Your Name <you@example.com>"]
2. Open the project in your preferred IDE (the standard for the team is Visual Studio Code).
3. Open the Terminal within Visual Studio Code.
4. Ensure you are in the root project directory where the `makefile` is located.
5. Execute the following commands:
  - uv initialization
    ````bash
    make uv_init
    ````
  - uv sync
    ````bash
    make uv_sync
    ````
6. Verify that the `.venv` folder has been generated within the `/backend` directory.

## Running the Application

After setting up the backend dependencies, you can run the development server:

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Start the FastAPI development server:
   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```

3. The backend API will be accessible at http://localhost:8000

**Note**: If port 8000 is already in use (e.g., by Docker containers), either stop the containers with `make clean` or use a different port like `--port 8001`.
