#!/bin/bash
# =============================================================
# Jenkins Pipeline Setup Script for Log Monitor
# =============================================================
# Run from the project root:  bash scripts/setup-jenkins.sh
# =============================================================

JENKINS_URL="http://192.168.1.111:8080"
JENKINS_USER="admin"
JENKINS_PASS="admin@123"
NEXUS_URL="http://192.168.1.111:8081"
NEXUS_DOCKER_PORT="8082"
NEXUS_USER="admin"
NEXUS_PASS="admin@123"
JOB_NAME="log-monitor"

echo ""
echo "============================================="
echo " Step 1: Create Nexus Docker Hosted Repository"
echo "============================================="

echo "Checking Nexus connectivity..."
curl -s -u "${NEXUS_USER}:${NEXUS_PASS}" "${NEXUS_URL}/service/rest/v1/status"
echo ""

echo "Creating Docker hosted repository on port ${NEXUS_DOCKER_PORT}..."
curl -s -u "${NEXUS_USER}:${NEXUS_PASS}" \
  -X POST "${NEXUS_URL}/service/rest/v1/repositories/docker/hosted" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"docker-hosted\",
    \"online\": true,
    \"storage\": {
      \"blobStoreName\": \"default\",
      \"strictContentTypeValidation\": true,
      \"writePolicy\": \"ALLOW\"
    },
    \"docker\": {
      \"v1Enabled\": true,
      \"forceBasicAuth\": false,
      \"httpPort\": ${NEXUS_DOCKER_PORT}
    }
  }"
echo ""
echo " -> Docker hosted repository request sent"

echo ""
echo "============================================="
echo " Step 2: Add Nexus Credentials to Jenkins"
echo "============================================="

echo "Checking Jenkins connectivity..."
curl -s -u "${JENKINS_USER}:${JENKINS_PASS}" "${JENKINS_URL}/api/json" | head -c 100
echo ""

echo "Getting CSRF crumb..."
CRUMB_RESPONSE=$(curl -s -u "${JENKINS_USER}:${JENKINS_PASS}" "${JENKINS_URL}/crumbIssuer/api/json")
echo "Crumb response: ${CRUMB_RESPONSE}"

# Extract crumb value - try multiple methods
CRUMB=$(echo "${CRUMB_RESPONSE}" | grep -o '"crumb":"[^"]*"' | cut -d'"' -f4)
CRUMB_FIELD=$(echo "${CRUMB_RESPONSE}" | grep -o '"crumbRequestField":"[^"]*"' | cut -d'"' -f4)

echo "Crumb: ${CRUMB}"
echo "Crumb field: ${CRUMB_FIELD}"

CRUMB_HEADER=""
if [ -n "$CRUMB" ] && [ -n "$CRUMB_FIELD" ]; then
  CRUMB_HEADER="-H ${CRUMB_FIELD}:${CRUMB}"
  echo "Using crumb header: ${CRUMB_HEADER}"
fi

echo ""
echo "Adding Nexus credentials..."
curl -s -v -u "${JENKINS_USER}:${JENKINS_PASS}" \
  ${CRUMB_HEADER} \
  -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "json={
    \"\": \"0\",
    \"credentials\": {
      \"scope\": \"GLOBAL\",
      \"id\": \"nexus-credentials\",
      \"username\": \"${NEXUS_USER}\",
      \"password\": \"${NEXUS_PASS}\",
      \"description\": \"Nexus Docker Registry (port ${NEXUS_DOCKER_PORT})\",
      \"\$class\": \"com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl\"
    }
  }" 2>&1
echo ""

echo ""
echo "Adding Git credentials..."
GIT_REPO_URL=$(git remote get-url origin 2>/dev/null || echo "https://github.com/akilvhora/log-monitor.git")
# Use Jenkins admin credentials for Git access (Gitea uses same auth)
curl -s -v -u "${JENKINS_USER}:${JENKINS_PASS}" \
  ${CRUMB_HEADER} \
  -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "json={
    \"\": \"0\",
    \"credentials\": {
      \"scope\": \"GLOBAL\",
      \"id\": \"git-credentials\",
      \"username\": \"${JENKINS_USER}\",
      \"password\": \"${JENKINS_PASS}\",
      \"description\": \"Git repository credentials\",
      \"\$class\": \"com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl\"
    }
  }" 2>&1
echo ""

echo ""
echo "============================================="
echo " Step 3: Create Jenkins Pipeline Job"
echo "============================================="

GIT_REPO_URL=$(git remote get-url origin 2>/dev/null || echo "https://github.com/akilvhora/log-monitor.git")
echo "Git repo URL: ${GIT_REPO_URL}"

# Build job config XML — uses inline pipeline with explicit git step
# so Jenkins doesn't need SCM config to clone the repo.
JENKINSFILE_RAW=$(cat Jenkinsfile)
# XML-escape the Jenkinsfile content
JENKINSFILE_ESCAPED=$(echo "${JENKINSFILE_RAW}" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&apos;/g')

JOB_XML="<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin=\"workflow-job\">
  <description>CI/CD pipeline for Log Monitor</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty/>
    <jenkins.model.BuildDiscarderProperty>
      <strategy class=\"hudson.tasks.LogRotator\">
        <daysToKeep>-1</daysToKeep>
        <numToKeep>10</numToKeep>
        <artifactDaysToKeep>-1</artifactDaysToKeep>
        <artifactNumToKeep>-1</artifactNumToKeep>
      </strategy>
    </jenkins.model.BuildDiscarderProperty>
  </properties>
  <definition class=\"org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition\" plugin=\"workflow-cps\">
    <script>${JENKINSFILE_ESCAPED}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>"

echo "Creating pipeline job '${JOB_NAME}'..."
echo "${JOB_XML}" | curl -s -v -u "${JENKINS_USER}:${JENKINS_PASS}" \
  ${CRUMB_HEADER} \
  -X POST "${JENKINS_URL}/createItem?name=${JOB_NAME}" \
  -H "Content-Type: application/xml" \
  --data-binary @- 2>&1
echo ""

echo ""
echo "============================================="
echo " Checking if job was created..."
echo "============================================="
curl -s -u "${JENKINS_USER}:${JENKINS_PASS}" "${JENKINS_URL}/job/${JOB_NAME}/api/json" | head -c 200
echo ""

echo ""
echo "============================================="
echo " Done!"
echo "============================================="
echo " Jenkins Job:  ${JENKINS_URL}/job/${JOB_NAME}/"
echo " Nexus UI:     ${NEXUS_URL}"
echo " Docker Reg:   192.168.1.111:${NEXUS_DOCKER_PORT}"
echo ""
