import React from 'react';

import {PrefetchContext, PrefetchManager} from './context/prefetch';
import {EventListener} from './EventListener';

interface Props {
  manager: PrefetchManager;
}

interface State {
  url?: URL;
}

interface NavigatorWithConnection extends Navigator {
  connection: {saveData: boolean};
}

export const INTENTION_DELAY_MS = 2000;
export const SENSITIVITY = 10;

class ConnectedPrefetcher extends React.PureComponent<Props, State> {
  state: State = {};
  private timeout?: ReturnType<typeof setTimeout>;
  private timeoutUrl?: URL;
  private prefetchAgressively = shouldPrefetchAggressively();

  private x = 0;
  private y = 0;
  private pX = 0;
  private pY = 0;

  render() {
    const {url} = this.state;
    const {manager} = this.props;
    const preloadMarkup = url ? (
      <div style={{visibility: 'hidden'}}>
        {findMatches(manager.registered, url).map(({render, path}, index) => {
          // eslint-disable-next-line react/no-array-index-key
          return <div key={`${path}${index}`}>{render(url)}</div>;
        })}
      </div>
    ) : null;

    const expensiveListeners = this.prefetchAgressively ? (
      <>
        <EventListener
          passive
          event="mouseover"
          handler={this.handlePointerEnter}
        />
        <EventListener
          passive
          event="focusin"
          handler={this.handlePointerEnter}
        />
        <EventListener
          passive
          event="mouseout"
          handler={this.handlePointerLeave}
        />
        <EventListener
          passive
          event="focusout"
          handler={this.handlePointerLeave}
        />
        <EventListener
          passive
          event="mousemove"
          handler={this.handleMouseMove}
        />
      </>
    ) : null;

    return (
      <>
        <EventListener
          passive
          event="mousedown"
          handler={this.handlePressStart}
        />
        <EventListener
          passive
          event="touchstart"
          handler={this.handlePressStart}
        />
        {expensiveListeners}
        {preloadMarkup}
      </>
    );
  }

  private handleMouseMove = ({clientX, clientY}: MouseEvent) => {
    this.x = clientX;
    this.y = clientY;
  };

  private handlePressStart = ({target}: MouseEvent) => {
    this.clearTimeout();

    if (target == null) {
      return;
    }

    const url = closestUrlFromNode(target);

    if (url != null) {
      this.setState({url});
    }
  };

  private compare = (url: URL | undefined) => {
    const {x, y} = this;
    if (this.timeout) {
      this.clearTimeout();
    }
    // Calculate the change of the mouse position
    // If it is smaller than the sensitivity, we can assume that the user is intending on visiting the link
    if (Math.abs(this.pX - x) + Math.abs(this.pY - y) < SENSITIVITY) {
      this.setState({url});
    } else {
      this.pX = x;
      this.pY = y;
      this.timeout = setTimeout(() => this.compare(url), INTENTION_DELAY_MS);
    }
  };

  private handlePointerLeave = ({
    target,
    relatedTarget,
  }: MouseEvent | FocusEvent) => {
    const {url} = this.state;
    const {timeout, timeoutUrl} = this;

    if (target == null) {
      if (timeout) {
        this.clearTimeout();
      }

      return;
    }

    if (url == null && timeout == null) {
      return;
    }

    const closestUrl = closestUrlFromNode(target);
    const relatedUrl = relatedTarget && closestUrlFromNode(relatedTarget);

    if (
      timeout != null &&
      urlsEqual(closestUrl, timeoutUrl) &&
      !urlsEqual(relatedUrl, timeoutUrl)
    ) {
      this.clearTimeout();
    }

    if (urlsEqual(closestUrl, url) && !urlsEqual(relatedUrl, url)) {
      this.setState({url: undefined});
    }
  };

  private handlePointerEnter = (event: MouseEvent | FocusEvent) => {
    const {target} = event;
    if (target == null) {
      return;
    }

    const {timeoutUrl, timeout} = this;
    const url = closestUrlFromNode(target);

    if (url == null) {
      return;
    }

    if (timeout) {
      if (urlsEqual(url, timeoutUrl)) {
        return;
      } else {
        this.clearTimeout();
      }
    }

    this.timeoutUrl = url;

    this.compare(url);
  };

  private clearTimeout() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
      this.timeoutUrl = undefined;
    }
  }
}

export function Prefetcher(props: Omit<Props, 'manager'>) {
  return (
    <PrefetchContext.Consumer>
      {(manager) => <ConnectedPrefetcher {...props} manager={manager} />}
    </PrefetchContext.Consumer>
  );
}

function shouldPrefetchAggressively() {
  return (
    typeof navigator === 'undefined' ||
    !('connection' in navigator) ||
    !(navigator as NavigatorWithConnection).connection.saveData
  );
}

function urlsEqual(first?: URL | null, second?: URL) {
  return (
    (first == null && first === second) ||
    (first != null && second != null && first.href === second.href)
  );
}

function findMatches(records: PrefetchManager['registered'], url: URL) {
  return [...records].filter(({path: match}) => matches(url, match));
}

function matches(url: URL, matcher: string | RegExp) {
  return typeof matcher === 'string'
    ? matcher === url.pathname
    : matcher.test(url.pathname);
}

function closestUrlFromNode(element: EventTarget) {
  if (!(element instanceof HTMLElement)) {
    return undefined;
  }

  // data-href is a hack for resource list doing the <a> as a sibling
  const closestUrl = element.closest('[href], [data-href]');

  if (closestUrl == null || !(closestUrl instanceof HTMLElement)) {
    return undefined;
  }

  const url =
    closestUrl.getAttribute('href') || closestUrl.getAttribute('data-href');

  try {
    return url ? new URL(url, window.location.href) : undefined;
  } catch (error) {
    return undefined;
  }
}
