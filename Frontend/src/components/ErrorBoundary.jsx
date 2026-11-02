import { Component } from 'react';
import Logo from './ui/Logo';
import Icon from './ui/Icon';

/**
 * Branded error boundary.
 * Keeps a broken page from turning into a blank white screen during a demo.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash__card anim-up">
          <Logo size="md" subtitle="University Platform" />
          <span className="crash__icon">
            <Icon name="alert" size={22} />
          </span>
          <h1>Something went wrong</h1>
          <p>
            The page hit an unexpected error. Your data is safe — reload to continue where you
            left off.
          </p>
          <code>{String(error.message || error)}</code>
          <button type="button" className="btn btn--primary" onClick={this.handleReload}>
            <Icon name="refresh" size={17} /> Reload the page
          </button>
        </div>
      </div>
    );
  }
}
