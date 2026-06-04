"""Browser controller concurrency and stress tests.

Tests for:
- Concurrent browser operations
- Tab switching under load
- Multiple controller instances
- State persistence reliability
- Race conditions
- Resource cleanup under concurrent access
"""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from collections.abc import Callable

import pytest

from sediman.browser.controller import BrowserController, PageSnapshot, ElementInfo


class MockBrowserPage:
    """Mock Playwright page for testing."""

    def __init__(self):
        self.url = "https://example.com"
        self._title = "Example Page"
        self._content = "<html><body>Test content</body></html>"
        self._elements = []
        self._call_count = 0

    async def goto(self, url, **kwargs):
        self.url = url
        await asyncio.sleep(0.01)  # Simulate network delay

    async def title(self):
        await asyncio.sleep(0.005)
        return self._title

    async def evaluate(self, script, *args):
        await asyncio.sleep(0.01)
        if "snapshot" in str(script) or "elements" in str(script):
            return self._elements
        elif "innerText" in str(script):
            return "Test page content"
        elif "scroll" in str(script):
            return {"x": 0, "y": 100}
        return None

    def query_selector(self, selector):
        mock_el = MagicMock()
        mock_el.evaluate = AsyncMock(return_value="button")
        mock_el.click = AsyncMock()
        mock_el.fill = AsyncMock()
        mock_el.press = AsyncMock()
        mock_el.scroll_into_view_if_needed = AsyncMock()
        mock_el.hover = AsyncMock()
        mock_el.select_option = AsyncMock()
        return mock_el

    async def query_selector_all(self, selector):
        return [self.query_selector(selector)]

    async def screenshot(self, **kwargs):
        await asyncio.sleep(0.02)
        return b"fake_screenshot_data"

    def wait_for_load_state(self, state, **kwargs):
        return AsyncMock()

    async def wait_for_selector(self, selector, timeout=5000):
        await asyncio.sleep(0.01)
        return self.query_selector(selector)


class MockBrowserContext:
    """Mock Playwright browser context."""

    def __init__(self, page_count=3):
        self.pages = [MockBrowserPage() for _ in range(page_count)]
        self._storage_state = {"cookies": [{"name": "test", "value": "123"}]}

    async def add_cookies(self, cookies):
        await asyncio.sleep(0.01)

    async def storage_state(self):
        await asyncio.sleep(0.01)
        return self._storage_state

    def new_page(self):
        new_page = MockBrowserPage()
        self.pages.append(new_page)
        return new_page


class MockBrowser:
    """Mock Playwright browser instance."""

    def __init__(self):
        self.context = MockBrowserContext()
        self._closed = False

    async def close(self):
        self._closed = True
        await asyncio.sleep(0.01)


class MockPlaywright:
    """Mock Playwright instance."""

    def __init__(self):
        self._started = False

    async def start(self):
        self._started = True
        await asyncio.sleep(0.01)
        return self

    async def stop(self):
        self._started = False
        await asyncio.sleep(0.01)


class TestBrowserControllerConcurrency:
    """Test concurrent browser controller operations."""

    @pytest.fixture
    async def mock_controller(self):
        """Create a controller with mocked browser."""
        controller = BrowserController(headless=True)

        # Mock the async_playwright context manager
        mock_pw = MockPlaywright()
        mock_browser = MockBrowser()

        with patch("sediman.browser.controller.async_playwright") as mock_async_playwright:
            async def mock_playwright_context():
                return mock_pw

            mock_async_playwright.return_value = mock_playwright_context()
            mock_playwright_context.chromium = MagicMock()

            async def mock_launch(**kwargs):
                await asyncio.sleep(0.01)
                return mock_browser

            mock_playwright_context.chromium.launch_persistent_context = mock_launch

            await controller.start()
            controller._own_page = mock_browser.context.pages[0]

            yield controller

            await controller.stop()

    @pytest.mark.asyncio
    async def test_concurrent_snapshot_calls(self, mock_controller):
        """Handles concurrent snapshot generation safely."""
        # Create tasks for concurrent snapshot calls
        tasks = [mock_controller.snapshot() for _ in range(10)]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should complete successfully
        assert len(results) == 10
        assert all(isinstance(r, PageSnapshot) for r in results)

    @pytest.mark.asyncio
    async def test_concurrent_navigation(self, mock_controller):
        """Handles concurrent navigation calls safely."""
        urls = [
            "https://example.com/page1",
            "https://example.com/page2",
            "https://example.com/page3",
        ]

        # Navigate concurrently
        tasks = [mock_controller.navigate(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should complete
        assert len(results) == 3
        assert all("Navigated to" in r for r in results)

    @pytest.mark.asyncio
    async def test_concurrent_element_actions(self, mock_controller):
        """Handles concurrent element interactions."""
        # Perform multiple actions concurrently
        tasks = [
            mock_controller.click(1),
            mock_controller.type_text(2, "test"),
            mock_controller.scroll("down"),
            mock_controller.screenshot(),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should complete
        assert len(results) == 4
        assert all(r is not None for r in results)

    @pytest.mark.asyncio
    async def test_concurrent_tab_switching(self, mock_controller):
        """Handles rapid tab switching under load."""
        # Create additional tabs
        mock_controller._own_page.context = MockBrowserContext(page_count=5)

        # Switch tabs rapidly
        tasks = [mock_controller.switch_tab(i % 5) for i in range(20)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Should handle rapid switching
        assert len(results) == 20
        assert all(isinstance(r, str) for r in results)

    @pytest.mark.asyncio
    async def test_concurrent_checkpoint_operations(self, mock_controller):
        """Handles concurrent checkpoint save/restore."""
        # Save multiple checkpoints concurrently
        save_tasks = [mock_controller.save_checkpoint() for _ in range(5)]
        save_results = await asyncio.gather(*save_tasks, return_exceptions=True)

        # All saves should succeed
        assert all(isinstance(r, int) for r in save_results)

        # Restore checkpoints concurrently
        restore_tasks = [mock_controller.restore_checkpoint(i) for i in range(5)]
        restore_results = await asyncio.gather(*restore_tasks, return_exceptions=True)

        # All restores should complete
        assert len(restore_results) == 5

    @pytest.mark.asyncio
    async def test_concurrent_state_persistence(self, mock_controller):
        """Handles concurrent state save/load operations."""
        # Perform concurrent state operations
        tasks = [
            mock_controller.save_state("state1"),
            mock_controller.save_state("state2"),
            mock_controller.load_state("state1"),
            mock_controller.save_state("state3"),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All operations should complete
        assert len(results) == 4

    @pytest.mark.asyncio
    async def test_concurrent_text_extraction(self, mock_controller):
        """Handles concurrent text extraction operations."""
        tasks = [
            mock_controller.extract_text(),
            mock_controller.extract_by_selector("p"),
            mock_controller.snapshot(),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All extractions should complete
        assert len(results) == 3
        assert all(isinstance(r, str) or isinstance(r, PageSnapshot) for r in results)


class TestMultipleControllerInstances:
    """Test multiple browser controller instances."""

    @pytest.mark.asyncio
    async def test_multiple_controllers_concurrent_start(self):
        """Handles multiple controllers starting concurrently."""
        controllers = [BrowserController(headless=True) for _ in range(3)]

        with patch("sediman.browser.controller.async_playwright"):
            # Start all controllers concurrently
            start_tasks = [ctrl.start() for ctrl in controllers]
            results = await asyncio.gather(*start_tasks, return_exceptions=True)

            # All should start successfully
            assert len(results) == 3

            # Cleanup
            stop_tasks = [ctrl.stop() for ctrl in controllers]
            await asyncio.gather(*stop_tasks, return_exceptions=True)

    @pytest.mark.asyncio
    async def test_controller_isolation(self):
        """Controllers maintain isolated state."""
        controller1 = BrowserController(headless=True)
        controller2 = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller1.start()
            await controller2.start()

            # Controllers should be independent
            assert controller1._started != controller2._started or controller1 != controller2

            await controller1.stop()
            await controller2.stop()


class TestResourceCleanupUnderLoad:
    """Test resource cleanup under concurrent operations."""

    @pytest.mark.asyncio
    async def test_cleanup_during_active_operations(self):
        """Handles cleanup while operations are active."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Start some long-running operations
            tasks = [
                controller.snapshot(),
                controller.extract_text(),
                controller.navigate("https://example.com"),
            ]

            # Stop controller while operations are running
            await controller.stop()

            # Operations should complete or be cancelled
            results = await asyncio.gather(*tasks, return_exceptions=True)
            assert len(results) == 3

    @pytest.mark.asyncio
    async def test_multiple_start_stop_cycles(self):
        """Handles rapid start/stop cycles."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            for _ in range(3):
                await controller.start()
                assert controller.is_started
                await controller.stop()
                assert not controller.is_started


class TestRaceConditions:
    """Test for potential race conditions."""

    @pytest.mark.asyncio
    async def test_start_race_condition(self):
        """Handles concurrent start calls safely."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            # Start the controller multiple times concurrently
            tasks = [controller.start() for _ in range(10)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Should only start once
            assert controller._started
            assert len(results) == 10

            await controller.stop()

    @pytest.mark.asyncio
    async def test_stop_race_condition(self):
        """Handles concurrent stop calls safely."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Stop multiple times concurrently
            tasks = [controller.stop() for _ in range(5)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Should handle gracefully
            assert not controller.is_started
            assert len(results) == 5

    @pytest.mark.asyncio
    async def test_page_provider_race_condition(self):
        """Handles page provider changes during operations."""
        controller = BrowserController(headless=True)

        # Mock page provider
        call_count = 0

        def mock_provider():
            nonlocal call_count
            call_count += 1
            if call_count % 2 == 0:
                return None  # Simulate transient failure
            return MockBrowserPage()

        controller.set_page_provider(mock_provider)

        # Perform operations that use the page provider
        results = await asyncio.gather(
            controller.navigate("https://example.com"),
            controller.snapshot(),
            controller.get_url(),
            return_exceptions=True,
        )

        # Should handle provider changes
        assert len(results) == 3


class TestMemoryAndStateConsistency:
    """Test memory and state consistency under concurrent access."""

    @pytest.mark.asyncio
    async def test_checkpoint_state_consistency(self):
        """Maintains consistent checkpoint state under concurrent access."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Create checkpoints concurrently
            save_tasks = [controller.save_checkpoint() for _ in range(10)]
            indices = await asyncio.gather(*save_tasks)

            # Verify all checkpoints were saved
            assert len(indices) == 10
            assert all(isinstance(i, int) for i in indices)
            assert len(set(indices)) == 10  # All unique

            # Clear checkpoints
            controller.clear_checkpoints()
            assert len(controller._saved_states) == 0

            await controller.stop()

    @pytest.mark.asyncio
    async def test_element_counter_consistency(self):
        """Maintains consistent element counter under concurrent access."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Generate snapshots concurrently
            snapshot_tasks = [controller.snapshot() for _ in range(5)]
            snapshots = await asyncio.gather(*snapshot_tasks)

            # Each snapshot should have consistent element IDs
            for snapshot in snapshots:
                if snapshot.elements:
                    ref_ids = [el.ref_id for el in snapshot.elements]
                    assert len(ref_ids) == len(set(ref_ids)), "Duplicate ref IDs found"

            await controller.stop()


class TestErrorHandlingUnderLoad:
    """Test error handling under concurrent operations."""

    @pytest.mark.asyncio
    async def test_error_isolation(self):
        """Errors in one operation don't affect others."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Mix operations that will fail with those that won't
            async def failing_operation():
                raise ValueError("Simulated error")

            tasks = [
                controller.snapshot(),
                failing_operation(),
                controller.navigate("https://example.com"),
                controller.get_title(),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Successful operations should succeed
            assert isinstance(results[0], PageSnapshot)
            assert isinstance(results[2], str)
            assert isinstance(results[3], str)

            # Failed operation should return exception
            assert isinstance(results[1], Exception)

            await controller.stop()

    @pytest.mark.asyncio
    async def test_timeout_during_concurrent_operations(self):
        """Handles timeouts in concurrent operations."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Some operations might timeout
            async def slow_operation():
                await asyncio.sleep(10)
                return "done"

            tasks = [
                controller.snapshot(),
                slow_operation(),
                controller.navigate("https://example.com"),
            ]

            # Use timeout for gather
            results = await asyncio.gather(*tasks, return_exceptions=True, timeout=2)

            # Some operations should complete
            assert len(results) == 3

            await controller.stop()


class TestPerformanceUnderLoad:
    """Test performance characteristics under load."""

    @pytest.mark.asyncio
    async def test_snapshot_performance_under_load(self):
        """Maintains reasonable performance under snapshot load."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            # Create many snapshot tasks
            import time
            start_time = time.time()

            tasks = [controller.snapshot() for _ in range(20)]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            elapsed_time = time.time() - start_time

            # Should complete reasonably fast (less than 5 seconds for 20 snapshots)
            assert elapsed_time < 5.0
            assert len(results) == 20

            await controller.stop()

    @pytest.mark.asyncio
    async def test_navigation_performance_under_load(self):
        """Maintains reasonable navigation performance under load."""
        controller = BrowserController(headless=True)

        with patch("sediman.browser.controller.async_playwright"):
            await controller.start()

            import time
            start_time = time.time()

            # Navigate to multiple URLs
            urls = [f"https://example.com/page{i}" for i in range(10)]
            tasks = [controller.navigate(url) for url in urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            elapsed_time = time.time() - start_time

            # Should complete in reasonable time
            assert elapsed_time < 3.0
            assert len(results) == 10

            await controller.stop()