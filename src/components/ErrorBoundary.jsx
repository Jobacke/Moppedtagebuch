import React, { Component } from 'react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: 'var(--text-primary)', minHeight: '100vh' }}>
                    <h1 style={{ color: 'var(--danger)' }}>Hoppla, ein Fehler ist aufgetreten.</h1>
                    <p>Bitte lade die Seite neu oder versuche es später noch einmal.</p>
                    <details style={{ marginTop: '1rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        <summary>Details anzeigen</summary>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '1rem',
                            padding: '10px 20px',
                            background: 'var(--metal-silver)',
                            color: 'var(--accent-contrast)',
                            borderRadius: '999px',
                            border: 'none',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Seite neu laden
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
