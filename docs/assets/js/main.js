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

  function positiveIntegerList(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(
      new Set(value.filter((entry) => Number.isInteger(entry) && entry > 0)),
    );
  }

  function safeLocalAffiliationLogo(value) {
    const candidate = textValue(value);

    if (
      !/^\.\/assets\/images\/affiliations\/[a-z0-9._/-]+$/i.test(candidate) ||
      candidate.split('/').includes('..')
    ) {
      return null;
    }

    return candidate;
  }

  function safeHttpsUrl(value) {
    const candidate = textValue(value);

    if (!/^https:\/\//i.test(candidate)) {
      return null;
    }

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'https:' ? parsed.href : null;
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

  function renderAuthors(mount, value) {
    if (!mount) {
      return { count: 0, hasCorresponding: false };
    }

    mount.replaceChildren();
    const authors = Array.isArray(value)
      ? value.filter(
          (author) =>
            author && typeof author === 'object' && Boolean(textValue(author.name)),
        )
      : [];
    let hasCorresponding = false;

    authors.forEach(function (author, index) {
      const item = document.createElement('span');
      const name = document.createElement('span');
      const markers = document.createElement('sup');
      const affiliationIds = positiveIntegerList(author.affiliations);
      const corresponding = author.corresponding === true;

      item.className = 'research-team__author';
      name.textContent = textValue(author.name);
      markers.className = 'research-team__author-markers';
      markers.textContent = `${affiliationIds.join(',')}${corresponding ? '*' : ''}`;
      markers.setAttribute(
        'aria-label',
        [
          affiliationIds.length > 0 ? `Affiliations ${affiliationIds.join(' and ')}` : '',
          corresponding ? 'corresponding author' : '',
        ]
          .filter(Boolean)
          .join(', '),
      );

      item.append(name);
      if (markers.textContent) {
        item.append(markers);
      }
      mount.append(item);

      if (index < authors.length - 1) {
        mount.append(document.createTextNode(', '));
      }

      hasCorresponding ||= corresponding;
    });

    mount.hidden = authors.length === 0;
    return { count: authors.length, hasCorresponding };
  }

  function renderAffiliations(mount, value) {
    if (!mount) {
      return 0;
    }

    mount.replaceChildren();
    const affiliations = Array.isArray(value) ? value : [];
    const seenIds = new Set();
    let count = 0;

    for (const affiliation of affiliations) {
      if (!affiliation || typeof affiliation !== 'object') {
        continue;
      }

      const id = affiliation.id;
      const name = textValue(affiliation.name);
      const logo = safeLocalAffiliationLogo(affiliation.logo);

      if (!Number.isInteger(id) || id < 1 || seenIds.has(id) || !name || !logo) {
        continue;
      }

      const item = document.createElement('li');
      const marker = document.createElement('sup');
      const image = document.createElement('img');
      const label = document.createElement('span');

      item.className = 'research-team__affiliation';
      item.dataset.affiliationId = String(id);
      marker.className = 'research-team__affiliation-marker';
      marker.textContent = String(id);
      image.className = 'research-team__logo';
      image.src = logo;
      image.alt = textValue(affiliation.logoAlt) || `${name} logo`;
      image.decoding = 'async';
      if (Number.isInteger(affiliation.logoWidth) && affiliation.logoWidth > 0) {
        image.width = affiliation.logoWidth;
      }
      if (Number.isInteger(affiliation.logoHeight) && affiliation.logoHeight > 0) {
        image.height = affiliation.logoHeight;
      }
      label.className = 'research-team__affiliation-name';
      label.textContent = name;

      item.append(marker, image, label);
      mount.append(item);
      seenIds.add(id);
      count += 1;
    }

    mount.hidden = count === 0;
    return count;
  }

  function renderReleaseMetadata() {
    const release = config.release && typeof config.release === 'object' ? config.release : {};
    const metadata = document.querySelector('[data-release-metadata]');
    const authorResult = renderAuthors(
      document.querySelector('[data-release-authors]'),
      release.authors,
    );
    const affiliationCount = renderAffiliations(
      document.querySelector('[data-release-affiliations]'),
      release.affiliations,
    );

    const visibleFields = [
      authorResult.count > 0,
      affiliationCount > 0,
      setOptionalText(
        document.querySelector('[data-release-corresponding]'),
        authorResult.hasCorresponding ? '* Corresponding author' : '',
      ),
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
        const href = safeHttpsUrl(resources[key]);

        if (!href) {
          continue;
        }

        const link = document.createElement('a');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = key === 'arxiv' && !safeHttpsUrl(resources.paper) ? 'Read paper' : label;
        if (key === 'paper' || (key === 'arxiv' && !safeHttpsUrl(resources.paper))) {
          link.className = 'resource-link--primary';
        }
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

  function createVideoCard(entry, isFeatured, reduceMotion, viewer) {
    const card = document.createElement('figure');
    const media = document.createElement('div');
    const badge = document.createElement('span');
    const video = document.createElement('video');
    const body = document.createElement('figcaption');
    const heading = document.createElement('div');
    const title = document.createElement(isFeatured ? 'h3' : 'h4');
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
    if (viewer) {
      const expand = document.createElement('button');
      expand.type = 'button';
      expand.className = 'media-expand';
      expand.textContent = 'Expand video ↗';
      expand.setAttribute('aria-label', `Expand video: ${textValue(entry.title)}`);
      expand.setAttribute('aria-haspopup', 'dialog');
      expand.addEventListener('click', function () {
        attachVideoSource(video);
        viewer.openVideo(video, entry, expand);
      });
      heading.append(expand);
    }
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

  function renderVideos(reduceMotion, viewer) {
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
      const rendered = createVideoCard(entry, isFeatured, reduceMotion, viewer);
      rendered.card.dataset.task = ['hand-over', 'open-box', 'pour-water', 'open-drawer']
        .find((task) => textValue(entry.id).includes(task)) || '';
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

  function setupGalleryFilters() {
    const gallery = document.querySelector('#videos');
    const groups = Array.from(gallery?.querySelectorAll('.video-group') || []);
    if (groups.length === 0) return;
    const total = groups.reduce((sum, group) => sum + group.querySelectorAll('.video-card').length, 0);

    const form = document.createElement('form');
    form.className = 'gallery-filters';
    form.setAttribute('aria-label', 'Filter demonstration videos');
    form.addEventListener('submit', (event) => event.preventDefault());
    const selected = { task: 'all', condition: 'all' };
    const dimensions = [
      ['task', 'Task', [
        ['all', 'All tasks'], ['hand-over', 'Hand Over'], ['open-box', 'Open Box'],
        ['pour-water', 'Pour Water'], ['open-drawer', 'Open Drawer'],
      ]],
      ['condition', 'Condition', [
        ['all', 'All conditions'], ['main', 'Main tasks'], ['crossObject', 'Cross-object'],
        ['variedPose', 'Varied pose'], ['squat', 'Squat & manipulation'],
      ]],
    ];
    const results = document.createElement('div');
    results.className = 'gallery-results';
    const count = document.createElement('p');
    count.className = 'gallery-count';
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    count.setAttribute('aria-atomic', 'true');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'gallery-reset';
    reset.textContent = 'Reset filters';
    const empty = document.createElement('p');
    empty.className = 'gallery-empty';
    empty.textContent = 'No recordings match these filters. Try another task or reset the filters.';

    function update() {
      let visible = 0;
      for (const group of groups) {
        const category = group.querySelector('[data-video-category]').dataset.videoCategory;
        let groupCount = 0;
        for (const card of group.querySelectorAll('.video-card')) {
          const matches = (selected.task === 'all' || card.dataset.task === selected.task)
            && (selected.condition === 'all' || category === selected.condition);
          card.hidden = !matches;
          if (matches) groupCount += 1;
          else card.querySelector('video')?.pause();
        }
        group.hidden = groupCount === 0;
        visible += groupCount;
      }
      for (const fieldset of form.querySelectorAll('[data-filter]')) {
        for (const button of fieldset.querySelectorAll('button')) {
          button.setAttribute('aria-pressed', String(button.dataset.value === selected[fieldset.dataset.filter]));
        }
      }
      count.textContent = `${visible} of ${total} recordings`;
      empty.hidden = visible > 0;
      reset.disabled = selected.task === 'all' && selected.condition === 'all';
    }

    for (const [key, label, choices] of dimensions) {
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'gallery-filter';
      fieldset.dataset.filter = key;
      const legend = document.createElement('legend');
      legend.textContent = label;
      const options = document.createElement('div');
      options.className = 'gallery-filter__options';
      for (const [value, text] of choices) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.dataset.value = value;
        button.textContent = text;
        button.addEventListener('click', function () {
          selected[key] = value;
          update();
        });
        options.append(button);
      }
      fieldset.append(legend, options);
      form.append(fieldset);
    }
    reset.addEventListener('click', function () {
      selected.task = 'all';
      selected.condition = 'all';
      update();
      form.querySelector('button').focus({ preventScroll: true });
    });
    results.append(count, reset);
    form.append(results);
    groups[0].before(form, empty);
    update();
  }

  function createMediaViewer() {
    const dialog = document.createElement('dialog');
    if (typeof dialog.showModal !== 'function') return null;
    dialog.className = 'media-viewer';
    dialog.setAttribute('aria-labelledby', 'media-viewer-title');
    const header = document.createElement('div');
    header.className = 'media-viewer__header';
    const heading = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'media-viewer__eyebrow';
    const title = document.createElement('h2');
    title.id = 'media-viewer-title';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'media-viewer__close';
    close.textContent = 'Close ×';
    close.setAttribute('aria-label', 'Close media viewer');
    close.autofocus = true;
    heading.append(eyebrow, title);
    header.append(heading, close);
    const toolbar = document.createElement('div');
    toolbar.className = 'media-viewer__toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Figure zoom');
    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'media-viewer__zoom';
    zoomLabel.setAttribute('aria-live', 'polite');
    const stage = document.createElement('div');
    stage.className = 'media-viewer__stage';
    stage.tabIndex = 0;
    const caption = document.createElement('p');
    caption.className = 'media-viewer__caption';
    const status = document.createElement('p');
    status.className = 'media-viewer__status';
    status.setAttribute('role', 'status');
    const zoomButtons = new Map();
    let origin = null;
    let videoState = null;
    let activeImage = null;
    let zoom = 1;
    let scrollPosition = { x: 0, y: 0 };

    function fitImage() {
      if (!activeImage?.naturalWidth) return;
      const style = getComputedStyle(stage);
      // Use the full box so scrollbars from the previous zoom cannot shrink Fit.
      const width = stage.offsetWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = stage.offsetHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const fitWidth = Math.min(activeImage.naturalWidth, width,
        height * activeImage.naturalWidth / activeImage.naturalHeight);
      activeImage.style.width = `${Math.max(1, fitWidth) * zoom}px`;
      zoomLabel.textContent = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;
      zoomButtons.get('zoom-out').disabled = zoom <= 1;
      zoomButtons.get('zoom-in').disabled = zoom >= 4;
      if (zoom === 1) stage.scrollTo(0, 0);
    }
    for (const [action, label] of [['zoom-out', '−'], ['zoom-in', '+'], ['fit', 'Fit to view']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.viewerAction = action;
      button.textContent = label;
      if (action !== 'fit') button.setAttribute('aria-label', action === 'zoom-in' ? 'Zoom in' : 'Zoom out');
      button.addEventListener('click', function () {
        zoom = action === 'fit' ? 1 : Math.min(4, Math.max(1, zoom + (action === 'zoom-in' ? 0.5 : -0.5)));
        fitImage();
      });
      zoomButtons.set(action, button);
      toolbar.append(button);
    }
    toolbar.append(zoomLabel);
    dialog.append(header, toolbar, stage, caption, status);
    document.body.append(dialog);

    function open(kind, trigger, name, description) {
      origin = trigger;
      scrollPosition = { x: window.scrollX, y: window.scrollY };
      for (const video of document.querySelectorAll('video')) video.pause();
      dialog.dataset.kind = kind;
      title.textContent = name;
      caption.textContent = description;
      eyebrow.textContent = kind === 'image' ? 'Research figure' : 'Experiment recording';
      toolbar.hidden = kind !== 'image';
      status.textContent = '';
      status.hidden = true;
      stage.setAttribute('aria-label', kind === 'image' ? 'Figure; scroll to explore when zoomed' : 'Video playback');
      document.body.classList.add('media-viewer-open');
      dialog.showModal();
      close.focus({ preventScroll: true });
    }

    function moveVideo(video, parent, before, position) {
      parent.insertBefore(video, before);
      if (position > 0) {
        const restore = function () { video.currentTime = position; };
        if (video.readyState >= 1) restore();
        else video.addEventListener('loadedmetadata', restore, { once: true });
      }
    }

    function closeViewer() {
      dialog.close();
      restorePage();
    }
    close.addEventListener('click', closeViewer);
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeViewer();
    });
    dialog.addEventListener('click', function (event) {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom) closeViewer();
    });
    function restorePage() {
      if (!origin) return;
      if (videoState) {
        const { video, parent, next } = videoState;
        video.pause();
        video.removeEventListener('error', showVideoError);
        moveVideo(video, parent, next, video.currentTime);
        videoState = null;
      }
      activeImage = null;
      stage.replaceChildren();
      document.body.classList.remove('media-viewer-open');
      window.scrollTo({ left: scrollPosition.x, top: scrollPosition.y, behavior: 'instant' });
      origin?.focus({ preventScroll: true });
      origin = null;
    }
    dialog.addEventListener('close', function () {
      // A delayed close event must not clear a viewer that has already reopened.
      if (!dialog.open) restorePage();
    });
    window.addEventListener('resize', function () {
      if (dialog.open) fitImage();
    });
    function showVideoError() {
      status.hidden = false;
      status.textContent = 'Video unavailable. You can still view its poster and description.';
    }

    return {
      openVideo(video, entry, trigger) {
        const playing = !video.paused;
        const position = video.currentTime;
        videoState = { video, parent: video.parentNode, next: video.nextSibling };
        video.autoplay = false;
        open('video', trigger, textValue(entry.title), textValue(entry.caption));
        moveVideo(video, stage, null, position);
        video.addEventListener('error', showVideoError);
        if (video.error) showVideoError();
        if (playing) video.play().catch(() => {});
      },
      openImage(source, description, trigger, name) {
        zoom = 1;
        const image = document.createElement('img');
        image.className = 'media-viewer__image';
        image.alt = source.alt;
        activeImage = image;
        stage.append(image);
        open('image', trigger, name, description);
        status.hidden = false;
        status.textContent = 'Loading figure…';
        image.addEventListener('load', function () {
          if (activeImage !== image) return;
          status.hidden = true;
          fitImage();
        });
        image.addEventListener('error', function () {
          if (activeImage !== image) return;
          status.hidden = false;
          status.textContent = 'Figure unavailable. Close the viewer to return to the page.';
        });
        image.src = source.currentSrc || source.src;
      },
    };
  }

  function setupFigureViewers(viewer) {
    if (!viewer) return;
    for (const figure of document.querySelectorAll('.paper-figure')) {
      const image = figure.querySelector('img');
      if (!image) continue;
      const title = figure.closest('section').querySelector('h2').textContent;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'figure-trigger';
      button.setAttribute('aria-label', `Expand ${title.toLowerCase()} figure`);
      button.setAttribute('aria-haspopup', 'dialog');
      const hint = document.createElement('span');
      hint.className = 'figure-trigger__hint';
      hint.textContent = 'Expand figure ↗';
      image.before(button);
      button.append(image, hint);
      button.addEventListener('click', function () {
        viewer.openImage(image, figure.querySelector('figcaption')?.textContent.trim() || '', button, `${title} figure`);
      });
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
    const viewer = createMediaViewer();
    renderVideos(reduceMotion, viewer);
    setupGalleryFilters();
    setupFigureViewers(viewer);
    setupSectionNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
