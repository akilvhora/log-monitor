pipeline {
    agent any

    environment {
        REGISTRY      = 'server:8082'
        IMAGE_API     = "${REGISTRY}/log-monitor-api"
        IMAGE_WEB     = "${REGISTRY}/log-monitor-web"
        IMAGE_TAG     = "${env.BUILD_NUMBER}"
        REGISTRY_CRED = 'nexus-docker-creds'   // Jenkins credential ID
        DOCKER_BUILDKIT = '1'
    }

    options {
        disableConcurrentBuilds()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                echo "Building branch: ${env.BRANCH_NAME ?: 'main'} — build #${env.BUILD_NUMBER}"
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('API Image') {
                    steps {
                        bat "docker build --isolation hyperv --platform linux/amd64 -f docker/Dockerfile.api -t %IMAGE_API%:%IMAGE_TAG% ."
                    }
                }
                stage('Web Image') {
                    steps {
                        bat "docker build --isolation hyperv --platform linux/amd64 -f docker/Dockerfile.web -t %IMAGE_WEB%:%IMAGE_TAG% ."
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                withCredentials([usernamePassword(credentialsId: "${REGISTRY_CRED}", usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    bat """
                        docker login %REGISTRY% -u %REG_USER% -p %REG_PASS%
                        docker push %IMAGE_API%:%IMAGE_TAG%
                        docker push %IMAGE_API%:latest
                        docker tag  %IMAGE_API%:%IMAGE_TAG% %IMAGE_API%:latest
                        docker push %IMAGE_WEB%:%IMAGE_TAG%
                        docker tag  %IMAGE_WEB%:%IMAGE_TAG% %IMAGE_WEB%:latest
                        docker push %IMAGE_WEB%:latest
                    """
                }
            }
        }

        stage('Deploy') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo "Deploying build #${IMAGE_TAG} — update your docker-compose or k8s manifests here."
            }
        }
    }

    post {
        success {
            echo "Build ${BUILD_NUMBER} succeeded. Images pushed to ${REGISTRY}."
        }
        failure {
            echo "Build ${BUILD_NUMBER} failed."
        }
        always {
            bat """
                docker rmi %IMAGE_API%:%IMAGE_TAG% 2>nul
                docker rmi %IMAGE_WEB%:%IMAGE_TAG% 2>nul
                docker rmi %IMAGE_API%:latest 2>nul
                docker rmi %IMAGE_WEB%:latest 2>nul
                exit 0
            """
        }
    }
}
