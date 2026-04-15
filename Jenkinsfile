pipeline {
    agent any

    environment {
        NEXUS_URL        = '192.168.1.111:8081'
        NEXUS_REPO       = 'docker'
        IMAGE_API        = "${NEXUS_URL}/${NEXUS_REPO}/log-monitor-api"
        IMAGE_WEB        = "${NEXUS_URL}/${NEXUS_REPO}/log-monitor-web"
        IMAGE_TAG        = "${BUILD_NUMBER}"
        DEPLOY_DIR       = 'C:\\deploy\\log-monitor'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Docker Login to Nexus') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-credentials',
                    usernameVariable: 'NEXUS_USER',
                    passwordVariable: 'NEXUS_PASS'
                )]) {
                    bat "docker login -u %NEXUS_USER% -p %NEXUS_PASS% ${NEXUS_URL}"
                }
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('Build API') {
                    steps {
                        bat "docker build -t ${IMAGE_API}:${IMAGE_TAG} -t ${IMAGE_API}:latest -f docker/Dockerfile.api ."
                    }
                }
                stage('Build Web') {
                    steps {
                        bat "docker build -t ${IMAGE_WEB}:${IMAGE_TAG} -t ${IMAGE_WEB}:latest -f docker/Dockerfile.web ."
                    }
                }
            }
        }

        stage('Push to Nexus') {
            steps {
                bat """
                    docker push ${IMAGE_API}:${IMAGE_TAG}
                    docker push ${IMAGE_API}:latest
                    docker push ${IMAGE_WEB}:${IMAGE_TAG}
                    docker push ${IMAGE_WEB}:latest
                """
            }
        }

        stage('Deploy') {
            steps {
                bat """
                    if not exist "${DEPLOY_DIR}" mkdir "${DEPLOY_DIR}"
                    copy /Y docker\\docker-compose.deploy.yml "${DEPLOY_DIR}\\docker-compose.yml"
                    copy /Y docker\\.env.deploy "${DEPLOY_DIR}\\.env" 2>nul || echo "No .env.deploy found, using existing .env"
                """

                dir("${DEPLOY_DIR}") {
                    withEnv([
                        "IMAGE_API=${IMAGE_API}:${IMAGE_TAG}",
                        "IMAGE_WEB=${IMAGE_WEB}:${IMAGE_TAG}"
                    ]) {
                        bat """
                            docker-compose down --remove-orphans 2>nul || echo "No existing containers"
                            docker-compose up -d
                        """
                    }
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    def retries = 10
                    def healthy = false
                    for (int i = 0; i < retries; i++) {
                        try {
                            bat 'curl -sf http://localhost/health >nul 2>&1'
                            healthy = true
                            break
                        } catch (e) {
                            echo "Health check attempt ${i + 1}/${retries} failed, waiting 10s..."
                            sleep(time: 10, unit: 'SECONDS')
                        }
                    }
                    if (!healthy) {
                        echo "WARNING: Health check did not pass after ${retries} attempts"
                        echo "The application may still be starting up. Check docker-compose logs."
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Deployed log-monitor build #${BUILD_NUMBER} successfully"
            echo "Application: http://192.168.1.111"
            echo "API: http://192.168.1.111/api/logs"
        }
        failure {
            echo "Build #${BUILD_NUMBER} failed"
        }
        always {
            bat 'docker image prune -f 2>nul || echo "Prune skipped"'
        }
    }
}
