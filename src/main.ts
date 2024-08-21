import * as core from '@actions/core';
import { GitHub } from '@actions/github';

import { createGithubRelease, renderReleaseBody, createGitTag, renderReleaseName } from './lib/release';
import { commitParser } from './lib/commits';
import { retrieveLastReleasedVersion, bumpVersion, VersionType } from './lib/version';

export async function run() {
  try {
    // Global config
    const app = core.getInput('app', { required: false });
    const token = core.getInput('token', { required: true });
    const tagPrefix = app ? `${app}@` : `v`;

    const github = new GitHub(token);

    // Commit loading config
    const baseTag =
      core.getInput('baseTag', { required: false }) ||
      (await retrieveLastReleasedVersion(github, tagPrefix));
    const taskBaseUrl = core.getInput('taskBaseUrl', { required: false });
    const taskPrefix = core.getInput('taskPrefix', { required: false });

    // Release config
    const pushTag = core.getInput('pushTag', { required: false }) === 'true';
    const templatePath = core.getInput('templatePath', { required: true });
    const draft = core.getInput('draft', { required: false }) === 'true' || false;
    const prerelease = core.getInput('prerelease', { required: false }) === 'true' || false;
    const releaseReference = core.getInput('releaseReference', { required: false });


    const diffInfo = await commitParser(
      github,
      baseTag,
      taskPrefix,
      taskBaseUrl,
      app,
      releaseReference,
    );
    const { changes, tasks, pullRequests } = diffInfo;
    let { nextVersionType } = diffInfo;
    // Force next version as release candidate if prerelease draft is created
    if (prerelease) nextVersionType = VersionType.prerelease;

    const releaseTag =
      core.getInput('releaseTag', { required: false }) ||
      (await bumpVersion(github, tagPrefix, nextVersionType, baseTag));
    if (pushTag) {
      createGitTag(github, releaseTag);
    }
    // Won't replace it if release tag is given manually
    const releaseVersion = releaseTag.replace(tagPrefix, '');
    const releaseName =
      core.getInput('releaseName', { required: false }) || renderReleaseName(releaseVersion, app);
    const body = renderReleaseBody(
      templatePath,
      app,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
    );
    await createGithubRelease(github, releaseTag, releaseName, body, draft, prerelease);
  } catch (error) {
    core.setFailed(error.message);
  }
}
