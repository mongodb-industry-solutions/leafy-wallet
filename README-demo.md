# [Demo Name Here]

[Small description of your demo here]

## Where MongoDB Shines?

[Small explanation of which MongoDB features are present]

## High Level Architecture

[High level architecture diagram here use [google slides](https://docs.google.com/presentation/d/1vo8Y8mBrocJtzvZc_tkVHZTsVW_jGueyUl-BExmVUtI/edit#slide=id.g30c066974c7_0_3536)]

## Tech Stack

[List your tech stackexample below]

- Next.js [App Router](https://nextjs.org/docs/app) for the framework
- [MongoDB Atlas](https://www.mongodb.com/atlas/database) for the database
- [CSS Modules](https://github.com/css-modules/css-modules) for styling

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Python 3.13 (but less than 3.14)
- Node.js 22 or higher
- uv (install via [uv's official documentation](https://docs.astral.sh/uv/getting-started/installation/))

[Add more if needed]

## Run it Locally

### Backend

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

### Running Backend Locally

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

### Frontend

1. Navigate to the `frontend` folder.
2. Install dependencies by running:
```bash
npm install
```
3. Start the frontend development server with:
````bash
npm run dev
````
4. The frontend will now be accessible at http://localhost:3000 by default, providing a user interface.

## Run with Docker

Make sure to run this on the root directory.

1. To run with Docker use the following command:
```
make build
```
2. To delete the container and image run:
```
make clean
```

## Common errors

### Backend

- Check that you've created an `.env` file that contains your valid (and working) API keys, environment and index variables.

### Frontend

- Check that you've created an `.env.local` file that contains your valid (and working) API keys, environment and index variables.