(function () {
  'use strict';

  const config = globalThis.ROBOREACT_CONFIG;

  if (!config || typeof config !== 'object') {
    return;
  }

  const RESOURCE_LABELS = [
    ['paper', 'Paper'],
    ['arxiv', 'arXiv'],
    ['code', 'Code'],
    ['dataset', 'Dataset'],
    ['supplementary', 'Supplementary'],
  ];
  const SECTION_IDS = ['teaser', 'overview', 'method', 'videos', 'results'];

  function textValue(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function listValue(value) {
    return Array.isArray(value) ? value.map(textValue).filter(Boolean) : [];
  }

  function safeHttpUrl(value) {
    const candidate = textValue(value);

    if (!/^https?:\/\//i.test(candidate)) {
      return null;
    }

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch (error) {
      return null;
    }
  }

  function setOptionalText(element, value) {
    if (!element) {
      return false;
    }

    const text = textValue(value);
    element.textContent = text;
    element.hidden = !text;
    return Boolean(text);
  }

  function renderReleaseMetadata() {
    const release = config.release && typeof config.release === 'object' ? config.release : {};
    const metadata = document.querySelector('[data-release-metadata]');
    const authors = listValue(release.authors);
    const affiliations = listValue(release.affiliations);

    const visibleFields = [
      setOptionalText(document.querySelector('[data-release-authors]'), authors.join(', ')),
      setOptionalText(document.querySelector('[data-release-affiliations]'), affiliations.join(' · ')),
      setOptionalText(document.querySelector('[data-release-venue]'), textValue(release.venue)),
      setOptionalText(document.querySelector('[data-release-contact]'), textValue(release.contact)),
    ];

    if (metadata) {
      metadata.hidden = !visibleFields.some(Boolean);
    }

    const resourceMount = document.querySelector('[data-resource-links]');

    if (resourceMount) {
      resourceMount.replaceChildren();
      const resources =
        release.resources && typeof release.resources === 'object' ? release.resources : {};

      for (const [key, label] of RESOURCE_LABELS) {
        const href = safeHttpUrl(resources[key]);

        if (!href) {
          continue;
        }

        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        resourceMount.append(link);
      }

      resourceMount.hidden = resourceMount.childElementCount === 0;
    }

    const footerContact = document.querySelector('[data-footer-contact]');
    const contact = textValue(release.contact);

    if (footerContact) {
      footerContact.textContent = contact;
      footerContact.hidden = !contact;
    }

    renderCitation(release);
  }

  function selectCitation(code, status) {
    const selection = globalThis.getSelection ? globalThis.getSelection() : null;

    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (status) {
      status.textContent = 'Citation selected — copy it manually.';
    }
  }

  function renderCitation(release) {
    const citation = textValue(release.bibtex);
    const section = document.querySelector('#citation');
    const mount = document.querySelector('[data-citation-mount]');
    const status = document.querySelector('#citation-status');
    const navItems = document.querySelectorAll('[data-citation-nav]');

    for (const item of navItems) {
      item.hidden = !citation;
    }

    if (section) {
      section.hidden = !citation;
    }

    if (!mount) {
      return;
    }

    mount.replaceChildren();

    if (!citation) {
      return;
    }

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    const button = document.createElement('button');

    pre.className = 'citation-block';
    code.textContent = citation;
    pre.append(code);

    button.type = 'button';
    button.className = 'copy-button';
    button.dataset.copyCitation = '';
    button.textContent = 'Copy citation';
    button.addEventListener('click', async function () {
      try {
        if (!globalThis.navigator?.clipboard?.writeText) {
          throw new Error('Clipboard API unavailable');
        }

        await globalThis.navigator.clipboard.writeText(citation);
        if (status) {
          status.textContent = 'Citation copied to clipboard.';
        }
      } catch (error) {
        selectCitation(code, status);
      }
    });

    mount.append(pre, button);
  }

  function setVideoReady(card, status) {
    delete card.dataset.state;
    status.textContent = '';
    status.hidden = true;
  }

  function createVideoCard(entry, isFeatured, reduceMotion) {
    const card = document.createElement('figure');
    const media = document.createElement('div');
    const badge = document.createElement('span');
    const video = document.createElement('video');
    const body = document.createElement('figcaption');
    const heading = document.createElement('div');
    const title = document.createElement('h4');
    const caption = document.createElement('p');
    const status = document.createElement('p');

    card.className = isFeatured ? 'video-card video-card--featured' : 'video-card';
    card.dataset.videoId = textValue(entry.id);
    media.className = 'video-card__media';
    badge.className = 'speed-badge video-card__badge';
    badge.textContent = textValue(entry.speedLabel);

    video.controls = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.loop = isFeatured ? true : entry.loop === true;
    video.poster = textValue(entry.poster);
    video.setAttribute(
      'aria-label',
      textValue(entry.accessibleLabel) || `Video: ${textValue(entry.title)}`,
    );

    if (isFeatured) {
      video.src = textValue(entry.src);
      video.preload = 'metadata';
      video.autoplay = entry.autoplay === true && !reduceMotion.matches;
    } else {
      video.dataset.src = textValue(entry.src);
      video.preload = 'none';
    }

    body.className = 'video-card__body';
    heading.className = 'video-card__heading';
    title.className = 'video-card__title';
    title.textContent = textValue(entry.title);
    caption.className = 'video-card__caption';
    caption.textContent = textValue(entry.caption);
    status.className = 'video-card__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;

    video.addEventListener('error', function () {
      card.dataset.state = 'error';
      status.textContent = 'Video unavailable. The poster and description remain available.';
      status.hidden = false;
    });
    video.addEventListener('loadedmetadata', function () {
      setVideoReady(card, status);
    });
    video.addEventListener('loadeddata', function () {
      setVideoReady(card, status);
    });

    heading.append(title);
    body.append(heading, caption, status);
    media.append(badge, video);
    card.append(media, body);
    return { card, video };
  }

  function attachVideoSource(video) {
    const source = textValue(video.dataset.src);

    if (!source) {
      return;
    }

    video.src = source;
    delete video.dataset.src;
    video.load();
  }

  function renderVideos(reduceMotion) {
    const mounts = new Map();

    for (const mount of document.querySelectorAll('[data-video-category]')) {
      mount.replaceChildren();
      mounts.set(mount.dataset.videoCategory, mount);
    }

    const lazyVideos = [];
    let featuredVideo = null;
    const videos = Array.isArray(config.videos) ? config.videos : [];

    for (const entry of videos) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      const category = textValue(entry.category);
      const mount = mounts.get(category);

      if (!mount) {
        continue;
      }

      const isFeatured = category === 'featured';
      const rendered = createVideoCard(entry, isFeatured, reduceMotion);
      mount.append(rendered.card);

      if (isFeatured) {
        featuredVideo = rendered.video;
      } else {
        lazyVideos.push(rendered.video);
      }
    }

    if ('IntersectionObserver' in globalThis) {
      const observer = new IntersectionObserver(
        function (entries) {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            attachVideoSource(entry.target);
            observer.unobserve(entry.target);
          }
        },
        { rootMargin: '400px 0px' },
      );

      for (const video of lazyVideos) {
        observer.observe(video);
      }
    } else {
      for (const video of lazyVideos) {
        attachVideoSource(video);
      }
    }

    if (featuredVideo) {
      const pauseForReducedMotion = function (event) {
        if (!event.matches) {
          return;
        }

        featuredVideo.autoplay = false;
        featuredVideo.removeAttribute('autoplay');
        featuredVideo.pause();
      };

      if (typeof reduceMotion.addEventListener === 'function') {
        reduceMotion.addEventListener('change', pauseForReducedMotion);
      } else if (typeof reduceMotion.addListener === 'function') {
        reduceMotion.addListener(pauseForReducedMotion);
      }
    }
  }

  function setupSectionNavigation() {
    if (!('IntersectionObserver' in globalThis)) {
      return;
    }

    const ids = SECTION_IDS.slice();
    const citation = document.querySelector('#citation');

    if (citation && !citation.hidden) {
      ids.push('citation');
    }

    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const links = new Map();
    const ratios = new Map();

    for (const id of ids) {
      links.set(
        id,
        Array.from(
          document.querySelectorAll(
            `.research-index nav a[href="#${id}"], .mobile-header nav a[href="#${id}"]`,
          ),
        ),
      );
    }

    function updateCurrentSection() {
      let currentId = null;
      let currentRatio = 0;

      for (const id of ids) {
        const ratio = ratios.get(id) || 0;
        if (ratio > currentRatio) {
          currentId = id;
          currentRatio = ratio;
        }
      }

      for (const [id, sectionLinks] of links) {
        for (const link of sectionLinks) {
          if (id === currentId) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        }
      }
    }

    const observer = new IntersectionObserver(
      function (entries) {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        updateCurrentSection();
      },
      {
        rootMargin: '-15% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }
  }

  function initialize() {
    const reduceMotion = globalThis.matchMedia
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

    renderReleaseMetadata();
    renderVideos(reduceMotion);
    setupSectionNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
