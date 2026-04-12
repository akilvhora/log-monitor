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

        stage('Setup Buildx') {
            steps {
                bat 'docker buildx create --name linux-builder --driver docker-container --platform linux/amd64 --use --bootstrap 2>nul || docker buildx use linux-builder'
            }
        }

        stage('Build Docker Images') {
            parallel {
                stage('API Image') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: "${REGISTRY_CRED}", usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                            bat "docker buildx build --platform linux/amd64 --provenance=false -f docker/Dockerfile.api -t ${IMAGE_API}:${IMAGE_TAG} -t ${IMAGE_API}:latest --output type=registry,registry.insecure=true --push ."
                        }
                    }
                }
                stage('Web Image') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: "${REGISTRY_CRED}", usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                            bat "docker buildx build --platform linux/amd64 --provenance=false -f docker/Dockerfile.web -t ${IMAGE_WEB}:${IMAGE_TAG} -t ${IMAGE_WEB}:latest --output type=registry,registry.insecure=true --push ."
                        }
                    }
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
            bat 'docker buildx rm linux-builder 2>nul || exit 0'
        }
    }
}
