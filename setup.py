from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in renting_services/__init__.py
from renting_services import __version__ as version

setup(
	name="renting_services",
	version=version,
	description="An app for renting services",
	author="MadCheese",
	author_email="leg.ly@hotmail.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
