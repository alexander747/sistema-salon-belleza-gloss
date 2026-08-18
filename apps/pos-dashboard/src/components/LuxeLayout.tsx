import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Divider,
  CircularProgress,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Group,
  ContentCut,
  Badge as BadgeIcon,
  Inventory2,
  ShoppingCart,
  AttachMoney,
  AddCircle,
  Logout,
  DarkMode,
  LightMode,
  Category,
  AccountBalanceWallet,
  ChevronLeft,
  ChevronRight,
  AccessTime,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useThemeMode } from '../context/ThemeContext';
import { canAccessPage, rolLabel } from '../utils/roles';

const DRAWER_WIDTH_EXPANDED = 260;
const DRAWER_WIDTH_COLLAPSED = 72;

interface SalonInfo {
  id: number;
  nombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  tema: string | null;
}

interface LuxeLayoutProps {
  user?: {
    nombre?: string;
    rol?: number;
    salon?: SalonInfo | null;
  } | null;
  onLogout: () => void;
  loading?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { label: 'Citas', href: '/agenda', icon: <CalendarMonth /> },
  { label: 'Clientes', href: '/clientes', icon: <Group /> },
  { label: 'Servicios', href: '/servicios', icon: <ContentCut /> },
  { label: 'Empleados', href: '/empleadas', icon: <BadgeIcon /> },
  { label: 'Productos', href: '/productos', icon: <Inventory2 /> },
  { label: 'Categorías', href: '/categorias', icon: <Category /> },
  { label: 'Ventas', href: '/ventas', icon: <ShoppingCart /> },
  { label: 'Finanzas', href: '/finanzas', icon: <AttachMoney /> },
  { label: 'Préstamos', href: '/prestamos', icon: <AccountBalanceWallet /> },
  { label: 'Horarios', href: '/horarios', icon: <AccessTime /> },
];

/** Ítems de navegación visibles para el rol del usuario (matriz de roles). */
function navItemsForRol(rol: number | null | undefined) {
  return NAV_ITEMS.filter((item) => canAccessPage(rol, item.href));
}

/* ── Contenido del sidebar (compartido entre drawer permanente y temporal) ── */

interface SidebarContentProps {
  collapsed: boolean;
  salonName?: string;
  visibleNavItems: NavItem[];
  /** En móvil el bloque de usuario vive acá (el header queda limpio). */
  showUser: boolean;
  userName?: string;
  roleLabel: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  collapsed,
  salonName,
  visibleNavItems,
  showUser,
  userName,
  roleLabel,
  onNavigate,
  onLogout,
}) => {
  const location = useLocation();

  const renderNavButton = (item: NavItem) => {
    const isActive = location.pathname === item.href;
    const button = (
      <ListItemButton
        onClick={() => onNavigate(item.href)}
        sx={{
          borderRadius: 3,
          mb: 0.5,
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 1 : 2,
          minHeight: 44,
          bgcolor: isActive ? 'primary.main' : 'transparent',
          color: isActive ? '#000' : 'text.secondary',
          '&:hover': {
            bgcolor: isActive ? 'primary.dark' : 'action.hover',
          },
        }}
      >
        <ListItemIcon
          sx={{
            color: isActive ? '#000' : 'text.secondary',
            minWidth: collapsed ? 0 : 40,
            justifyContent: 'center',
          }}
        >
          {item.icon}
        </ListItemIcon>
        {!collapsed && (
          <ListItemText
            primary={item.label}
            slotProps={{
              primary: {
                sx: {
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 400,
                },
              },
            }}
          />
        )}
      </ListItemButton>
    );

    if (collapsed) {
      return (
        <Tooltip title={item.label} placement="right" arrow>
          {button}
        </Tooltip>
      );
    }
    return button;
  };

  return (
    <>
      {/* Logo / Salon name */}
      <Box
        sx={{
          p: collapsed ? 1.5 : 2.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 1,
          minHeight: 64,
        }}
      >
        {collapsed ? (
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Playfair Display", serif',
              color: 'primary.main',
              fontWeight: 700,
            }}
          >
            {salonName?.charAt(0)?.toUpperCase() || 'S'}
          </Typography>
        ) : (
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Playfair Display", serif',
              color: 'primary.main',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 160,
            }}
          >
            {salonName || 'Sistema'}
          </Typography>
        )}
      </Box>
      <Divider />

      {/* Usuario (solo móvil: el header desktop lo muestra) */}
      {showUser && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Avatar sx={{ bgcolor: 'primary.main', color: '#000', fontWeight: 700 }}>
            {userName?.charAt(0)?.toUpperCase() || 'D'}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userName || roleLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {roleLabel}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <List sx={{ flex: 1, px: collapsed ? 0.5 : 1.5, pt: 1 }}>
        {visibleNavItems.map((item) => (
          <ListItem key={item.href} disablePadding>
            {renderNavButton(item)}
          </ListItem>
        ))}
      </List>

      <Divider />

      {/* New Appointment CTA */}
      <Box sx={{ p: collapsed ? 1 : 2, display: 'flex', justifyContent: 'center' }}>
        {collapsed ? (
          <Tooltip title="Nueva Cita" placement="right" arrow>
            <IconButton
              onClick={() => onNavigate('/agenda')}
              sx={{
                bgcolor: 'primary.main',
                color: '#000',
                borderRadius: 2,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <AddCircle />
            </IconButton>
          </Tooltip>
        ) : (
          <ListItemButton
            onClick={() => onNavigate('/agenda')}
            sx={{
              borderRadius: 3,
              bgcolor: 'primary.main',
              color: '#000',
              justifyContent: 'center',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <AddCircle sx={{ mr: 1 }} />
            <ListItemText
              primary="Nueva Cita"
              slotProps={{ primary: { sx: { fontWeight: 600 } } }}
            />
          </ListItemButton>
        )}
      </Box>

      {/* Bottom actions */}
      <List sx={{ px: collapsed ? 0.5 : 1.5 }}>
        <ListItem disablePadding>
          <Tooltip title="Cerrar sesión" placement="right" arrow disableHoverListener={!collapsed}>
            <ListItemButton
              onClick={onLogout}
              sx={{
                borderRadius: 3,
                color: 'error.main',
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1 : 2,
                minHeight: 44,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed ? 0 : 40,
                  justifyContent: 'center',
                  color: 'error.main',
                }}
              >
                <Logout />
              </ListItemIcon>
              {!collapsed && <ListItemText primary="Cerrar sesión" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </>
  );
};

/* ── Layout principal ── */

const LuxeLayout: React.FC<LuxeLayoutProps> = ({ user, onLogout, loading }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleColorMode } = useThemeMode();

  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // El colapso es un concepto de desktop: en móvil el drawer siempre se abre expandido.
  const isCollapsed = !isMobile && collapsed;
  const drawerWidth = isCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH_EXPANDED;
  const salonName = user?.salon?.nombre;
  const roleLabel = rolLabel(user?.rol);
  const visibleNavItems = navItemsForRol(user?.rol);

  /* ── Dynamic document title ── */
  useEffect(() => {
    document.title = salonName ? `${salonName} | Dashboard` : 'Dashboard';
  }, [salonName]);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      // La preferencia de colapso solo se persiste en desktop (≥ md).
      if (!isMobile) localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  const handleNavigate = (href: string) => {
    navigate(href);
    if (isMobile) setMobileOpen(false);
  };

  const getPageTitle = () => {
    const item = NAV_ITEMS.find((i) => i.href === location.pathname);
    return item ? item.label : 'Dashboard';
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ── Sidebar: temporal < md (hamburger), permanente ≥ md ── */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : undefined}
        onClose={() => setMobileOpen(false)}
        {...(isMobile ? { keepMounted: true } : {})}
        sx={{
          // En el drawer temporal (Modal) no se aplican width/flexShrink al root:
          // romperían el overlay. Solo importan para el docked (permanente).
          ...(!isMobile && {
            width: drawerWidth,
            flexShrink: 0,
            transition: 'width 0.3s ease',
          }),
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: 'width 0.3s ease',
          },
        }}
      >
        <SidebarContent
          collapsed={isCollapsed}
          salonName={salonName}
          visibleNavItems={visibleNavItems}
          showUser={isMobile}
          userName={user?.nombre}
          roleLabel={roleLabel}
          onNavigate={handleNavigate}
          onLogout={onLogout}
        />
      </Drawer>

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'background.default',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar>
            {/* Móvil: hamburger abre el drawer temporal. Desktop: toggle de colapso. */}
            {isMobile ? (
              <IconButton
                onClick={() => setMobileOpen(true)}
                sx={{ mr: 1, width: 44, height: 44 }}
                aria-label="Abrir menú"
              >
                <MenuIcon />
              </IconButton>
            ) : (
              <IconButton
                onClick={toggleSidebar}
                sx={{ mr: 1 }}
                size="small"
                aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              >
                {collapsed ? <ChevronRight /> : <ChevronLeft />}
              </IconButton>
            )}

            <Typography
              variant="h1"
              sx={{ fontSize: '1.5rem', fontWeight: 700, flex: 1 }}
            >
              {getPageTitle()}
            </Typography>

            {/* Salon name badge in header */}
            {salonName && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
              >
                {salonName}
              </Typography>
            )}

            <IconButton onClick={toggleColorMode}>
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>
            {!isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 1 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {user?.nombre || roleLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {roleLabel}
                  </Typography>
                </Box>
                <Avatar
                  sx={{ bgcolor: 'primary.main', color: '#000', fontWeight: 700 }}
                >
                  {user?.nombre?.charAt(0)?.toUpperCase() || 'D'}
                </Avatar>
              </Box>
            )}
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default LuxeLayout;
