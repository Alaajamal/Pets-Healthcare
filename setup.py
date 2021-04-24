# -*- coding: utf-8 -*-
from setuptools import setup, find_packages

with open('requirements.txt') as f:
	install_requires = f.read().strip().split('\n')

# get version from __version__ variable in pets_healthcare/__init__.py
from pets_healthcare import __version__ as version

setup(
	name='pets_healthcare',
	version=version,
	description='Customization for Healthcare system to suppourt pets ',
	author='mawred',
	author_email='ahmad18189@gmail.com',
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
