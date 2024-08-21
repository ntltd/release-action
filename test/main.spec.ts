import { getInput, setFailed } from '@actions/core';
import { GitHub } from '@actions/github';
import {
  retrieveLastReleasedVersion, bumpVersion, VersionType,
} from 'ntltd/release-generator/lib/version';
import { run } from 'ntltd/release-generator/main';
import {
  createGitTag, createGithubRelease, renderReleaseBody, renderReleaseName,
} from 'ntltd/release-generator/lib/release';
import { commitParser } from 'ntltd/release-generator/lib/commits';

jest.mock('@actions/github');
jest.mock('@actions/core');
jest.mock('ntltd/release-generator/lib/commits');
jest.mock('ntltd/release-generator/lib/release');
jest.mock('ntltd/release-generator/lib/version');

describe('run', () => {
  // Required input values
  const templatePath = 'templates/release.md';
  const token = 'faketoken';
  // Default input values
  const taskPrefix = 'JIRA-';
  const draft = true;
  const prerelease = true;
  // Template stubs
  const changes = '';
  const nextVersionType = VersionType.patch;
  const tasks = '';
  const pullRequests = '';
  const body = 'releaseBody';

  beforeEach(() => {
    (commitParser as jest.Mock).mockImplementation(() => ({
      changes,
      nextVersionType,
      tasks,
      pullRequests,
    }));
    (renderReleaseBody as jest.Mock).mockImplementation(() => body);
  });

  test('with required params', async () => {
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'bumpProtection':
          return 'false';
        case 'draft':
          return `${draft}`;
        case 'prerelease':
          return `${prerelease}`;
        case 'pushTag':
          return 'false';
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        default:
          return undefined;
      }
    });
    const tagPrefix = 'v';

    const baseTag = 'v1.0.0';
    (retrieveLastReleasedVersion as jest.Mock).mockImplementation(() => baseTag);

    const releaseName = `draft prerelease`;
    (renderReleaseName as jest.Mock).mockImplementation(() => releaseName);
    const releaseVersion = '1.0.5';
    const releaseTag = `${tagPrefix}${releaseVersion}`;
    (bumpVersion as jest.Mock).mockImplementation(() => releaseTag);

    await run();

    expect(retrieveLastReleasedVersion).toBeCalledWith(expect.any(GitHub), tagPrefix);
    expect(commitParser).toBeCalledWith(
      expect.any(GitHub),
      baseTag,
      taskPrefix,
      undefined,
      undefined,
      undefined
    );
    expect(renderReleaseName).toBeCalledWith(releaseVersion, undefined);
    expect(renderReleaseBody).toBeCalledWith(
      templatePath,
      undefined,
      releaseVersion,
      changes,
      tasks,
      pullRequests,
    );
    expect(bumpVersion).toBeCalledWith(
      expect.any(GitHub),
      tagPrefix,
      VersionType.prerelease,
      baseTag,
    );
    expect(createGitTag).not.toBeCalled();
    expect(createGithubRelease).toBeCalledWith(
      expect.any(GitHub),
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('with specific production release and new release tag', async () => {
    const app = 'fake-app';
    const baseTag = 'v1.0.4';
    const givenDraft = false;
    const givenPrerelease = false;
    const releaseName = 'fake-app';
    const releaseTag = `mycustomprefix-1.0.6`;
    const taskBaseUrl = 'https://myfaketask.url';
    const releaseRef = 'v1.0.5';

    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'app':
          return app;
        case 'baseTag':
          return baseTag;
        case 'bumpProtection':
          return 'true';
        case 'draft':
          return `${givenDraft}`;
        case 'monorepo':
          return 'true';
        case 'prerelease':
          return `${givenPrerelease}`;
        case 'pushTag':
          return 'true';
        case 'releaseName':
          return releaseName;
        case 'releaseTag':
          return releaseTag;
        case 'taskBaseUrl':
          return taskBaseUrl;
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        case 'releaseReference':
          return releaseRef;
        default:
          return undefined;
      }
    });

    await run();

    expect(retrieveLastReleasedVersion).not.toBeCalled();
    expect(commitParser).toBeCalledWith(expect.any(GitHub), baseTag, taskPrefix, taskBaseUrl, app, releaseRef);
    expect(renderReleaseBody).toBeCalledWith(
      templatePath,
      app,
      releaseTag,
      changes,
      tasks,
      pullRequests,
    );
    expect(bumpVersion).not.toBeCalled();
    expect(createGitTag).toBeCalledWith(expect.any(GitHub), releaseTag);
    expect(createGithubRelease).toBeCalledWith(
      expect.any(GitHub),
      releaseTag,
      releaseName,
      body,
      givenDraft,
      givenPrerelease,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('unexpected error', async () => {
    const errorMsg = 'fake';
    (getInput as jest.Mock).mockImplementation(() => { throw new Error(errorMsg); });

    await run();
    expect(setFailed).toBeCalledWith(errorMsg);
  });
});
