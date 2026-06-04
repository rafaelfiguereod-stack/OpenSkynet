"""Dependency injection container for agent components.

This module provides a simple but powerful dependency injection
container that manages service lifecycle and dependencies.
"""

from __future__ import annotations

import inspect
from typing import Any, Callable, Dict, Optional, Type

import structlog

logger = structlog.get_logger()


class ServiceContainer:
    """Simple dependency injection container for agent components.

    This container:
    - Manages service lifecycle
    - Resolves dependencies automatically
    - Supports singleton and transient services
    - Enables better testing through dependency injection

    Example:
        ```python
        container = ServiceContainer()

        # Register services
        container.register(LLMProvider, llm_provider)
        container.register(ToolBus, lambda c: create_tool_bus())

        # Resolve services
        tool_bus = container.get(ToolBus)
        ```
    """

    def __init__(self):
        """Initialize the service container."""
        self._services: Dict[Type, Any] = {}
        self._factories: Dict[Type, Callable] = {}
        self._singletons: set[Type] = set()

    def register(
        self,
        interface: Type,
        implementation: Any,
        singleton: bool = True
    ) -> None:
        """Register a service implementation.

        Args:
            interface: Interface or base class
            implementation: Service instance or class
            singleton: Whether to keep as singleton (default: True)
        """
        if singleton:
            self._singletons.add(interface)

        if inspect.isclass(implementation):
            # Store class for lazy instantiation
            self._factories[interface] = implementation
        else:
            # Store instance directly
            self._services[interface] = implementation

        logger.debug(
            "service_registered",
            interface=interface.__name__,
            singleton=singleton,
        )

    def register_factory(
        self,
        interface: Type,
        factory: Callable
    ) -> None:
        """Register a factory function for creating services.

        Args:
            interface: Interface or base class
            factory: Factory function that takes container as argument
        """
        self._factories[interface] = factory
        self._singletons.add(interface)

        logger.debug("service_factory_registered", interface=interface.__name__)

    def get(self, interface: Type) -> Any:
        """Get a service instance.

        This method will:
        1. Return existing singleton instance
        2. Call factory to create new instance
        3. Instantiate class directly with dependencies

        Args:
            interface: Interface or class to get

        Returns:
            Service instance

        Raises:
            ValueError: If service cannot be created
        """
        # Return existing singleton
        if interface in self._services:
            return self._services[interface]

        # Use factory if available
        if interface in self._factories:
            factory = self._factories[interface]
            instance = factory(self)

            # Store as singleton
            if interface in self._singletons:
                self._services[interface] = instance

            return instance

        # Try to instantiate directly with dependencies
        if hasattr(interface, "__init__"):
            instance = self._instantiate(interface)
            if instance:
                if interface in self._singletons:
                    self._services[interface] = instance
                return instance

        raise ValueError(
            f"Cannot create instance of {interface.__name__}. "
            f"Register it first or provide a factory."
        )

    def _instantiate(self, cls: Type) -> Optional[Any]:
        """Instantiate a class with dependency injection.

        Args:
            cls: Class to instantiate

        Returns:
            Instance or None if instantiation failed
        """
        try:
            # Get constructor signature
            sig = inspect.signature(cls.__init__)

            # Build kwargs from container
            kwargs = {}
            for param_name, param in sig.parameters.items():
                if param_name == "self":
                    continue

                # Try to resolve dependency from container
                if param.annotation != inspect.Parameter.empty:
                    try:
                        kwargs[param_name] = self.get(param.annotation)
                    except ValueError:
                        # Dependency not available, try default
                        if param.default != inspect.Parameter.empty:
                            kwargs[param_name] = param.default

            # Create instance
            instance = cls(**kwargs)
            logger.debug("service_instantiated", class=cls.__name__)
            return instance

        except Exception as e:
            logger.warning(
                "service_instantiation_failed",
                class=cls.__name__,
                error=str(e),
            )
            return None

    def has(self, interface: Type) -> bool:
        """Check if container has a service.

        Args:
            interface: Interface or class to check

        Returns:
            True if service is registered
        """
        return interface in self._services or interface in self._factories

    def reset(self) -> None:
        """Reset the container, clearing all services."""
        self._services.clear()
        self._factories.clear()
        self._singletons.clear()
        logger.debug("container_reset")

    def get_registered_services(self) -> Dict[str, int]:
        """Get information about registered services.

        Returns:
            Dictionary with registration info
        """
        return {
            "total_services": len(self._services) + len(self._factories),
            "instantiated_services": len(self._services),
            "factory_services": len(self._factories),
            "singletons": len(self._singletons),
        }


class ServiceLocator:
    """Global service locator for dependency injection.

    This provides a global point of access to the service container,
    enabling dependency injection throughout the application.

    Example:
        ```python
        # Initialize locator with container
        locator = ServiceLocator.create(container)

        # Use locator to get services
        tool_bus = locator.get(ToolBus)
        llm_service = locator.get(LLMService)
        ```
    """

    _instance: Optional[ServiceLocator] = None

    def __init__(self, container: ServiceContainer):
        """Initialize the locator.

        Args:
            container: Service container to use
        """
        self._container = container

    @classmethod
    def create(cls, container: ServiceContainer) -> "ServiceLocator":
        """Create and initialize the global locator.

        Args:
            container: Service container to use

        Returns:
            ServiceLocator instance
        """
        cls._instance = ServiceLocator(container)
        return cls._instance

    @classmethod
    def get_instance(cls) -> Optional["ServiceLocator"]:
        """Get the global locator instance.

        Returns:
            ServiceLocator instance or None if not initialized
        """
        return cls._instance

    def get(self, interface: Type) -> Any:
        """Get a service from the container.

        Args:
            interface: Interface or class to get

        Returns:
            Service instance

        Raises:
            ValueError: If locator not initialized or service not found
        """
        if not self._container:
            raise ValueError("ServiceLocator not initialized. Call create() first.")

        return self._container.get(interface)

    def has(self, interface: Type) -> bool:
        """Check if container has a service.

        Args:
            interface: Interface or class to check

        Returns:
            True if service is registered
        """
        return self._container.has(interface)


def create_container(
    llm_provider=None,
    tool_bus=None,
    enable_llm_cache: bool = True,
    enable_tool_cache: bool = True,
    enable_metrics: bool = True,
) -> ServiceContainer:
    """Create and configure a service container with standard services.

    Args:
        llm_provider: Optional LLM provider to register
        tool_bus: Optional tool bus to register
        enable_llm_cache: Whether to enable LLM caching
        enable_tool_cache: Whether to enable tool caching
        enable_metrics: Whether to enable metrics collection

    Returns:
        Configured service container
    """
    from sediman.llm.service import LLMCache, LLMMetrics
    from sediman.llm.impl import MemoryLLMCache, LLMMetricsCollector
    from sediman.llm.factory import DefaultLLMServiceFactory
    from sediman.tools.service import ToolResultCache, ToolMetrics

    container = ServiceContainer()

    # Register LLM provider if provided
    if llm_provider:
        # Create LLM factory
        llm_cache = MemoryLLMCache() if enable_llm_cache else None
        llm_metrics = LLMMetricsCollector() if enable_metrics else None
        llm_factory = DefaultLLMServiceFactory(llm_provider, llm_cache, llm_metrics)
        container.register(LLMServiceFactory, llm_factory)

    # Register tool bus if provided
    if tool_bus:
        container.register(ToolBus, tool_bus)
    else:
        # Create default tool bus
        from sediman.tools.factory import create_tool_bus
        tool_bus = create_tool_bus(
            enable_cache=enable_tool_cache,
            enable_metrics=enable_metrics,
        )
        container.register(ToolBus, tool_bus)

    logger.info(
        "service_container_created",
        llm_provider=llm_provider is not None,
        tool_bus=tool_bus is not None,
    )

    return container


__all__ = [
    "ServiceContainer",
    "ServiceLocator",
    "create_container",
]
